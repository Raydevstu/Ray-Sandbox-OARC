# Drastic Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 audit-driven improvements: temporal version preference, entity scoping isolation, PostgreSQL backend persistence, auto-project detection, cross-project contamination guard, real MCP stdio server, and automated audit pipeline.

**Architecture:** Each improvement builds on existing modules without duplication. Improvements 1-2 fix recall pipeline behavior. Improvement 3 adds a PostgreSQL persistence layer behind the existing API routes. Improvements 4-5 extend the zustand store and filter DSL. Improvement 6 creates a standalone Node MCP server. Improvement 7 adds CI test scripts.

**Tech Stack:** Next.js 16 App Router, TypeScript, zustand (persist), PostgreSQL (pg driver), @modelcontextprotocol/sdk, Playwright, Vitest

**Spec:** Audit findings TM-046, TM-047, TM-061, TM-071, TM-072

## Global Constraints

- No new UI frameworks — use existing shadcn/ui components and Tailwind v4
- All store changes must include migration defaults (zustand-store-extension skill)
- All new engine modules must have unit tests (vitest) before implementation
- Typecheck (`tsc --noEmit`) must pass after every task
- No breaking changes to existing API routes — only additive
- PostgreSQL is optional — localStorage fallback must still work
- MCP server must be stdio-based (not HTTP) for agent compatibility

## Review Focus

- Facts without supersedes links: both versions returned equally — temporal preference must handle missing links
- Recall with no user_id set: entity scoping must not break anonymous recall
- PostgreSQL connection failure: must gracefully fall back to localStorage, not crash
- Project detection false positives: common words like "project" in casual text must not create banks
- MCP server crash on malformed input: must return structured error, not exit
- CI test flakiness: Playwright tests depend on server state — must seed deterministically

---

## File Structure

### New files
- `lib/engine/temporal-version.ts` — version preference logic for recall pipeline
- `lib/engine/project-id-filter.ts` — project_id dimension for filter DSL
- `mcp-server/index.ts` — real MCP stdio server
- `mcp-server/package.json` — MCP server dependencies
- `tests/e2e/audit-full.spec.ts` — consolidated audit test suite
- `docs/superpowers/plans/2026-11-08-drastic-improvements.md` — this plan

### Modified files
- `lib/engine/recall.ts` — add temporal version preference + entity scoping pre-pass
- `lib/engine/filters.ts` — add `project_id` to FILTER_FIELDS + fieldValue
- `lib/store.ts` — add `projectId` to scopes, `project_id` bank linking
- `lib/types.ts` — add `projectId` to MemoryScopes, `project_id` to FilterNode
- `app/api/v1/memory/retain/route.ts` — PostgreSQL persistence
- `app/api/v1/memory/recall/route.ts` — PostgreSQL persistence
- `package.json` — add `test:audit` script
- `app/sandbox/memory/page.tsx` — project_id in scopes, auto-filter on recall

---

## Task 1: Temporal Version Preference

**Files:**
- Create: `lib/engine/temporal-version.ts`
- Modify: `lib/engine/recall.ts:50-60` (historyPolicy default)
- Test: `lib/engine/__tests__/temporal-version.test.ts`

**Interfaces:**
- Consumes: `MemoryFact` (with `supersedes`, `mentionedAt`, `temporalMeta`)
- Produces: `preferLatestVersion(facts: MemoryFact[]): MemoryFact[]` — returns facts with highest version per entity group, sorted by recency

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { preferLatestVersion } from "../temporal-version";
import type { MemoryFact } from "@/lib/types";

describe("temporal version preference", () => {
  it("prefers v15 over v14 when both present", () => {
    const facts = [
      { id: "f1", text: "PostgreSQL 14", mentionedAt: "2024-01-01", supersedes: null, entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
      { id: "f2", text: "PostgreSQL 15", mentionedAt: "2024-02-01", supersedes: "f1", entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
    ] as MemoryFact[];
    const result = preferLatestVersion(facts);
    expect(result[0].text).toContain("15");
  });

  it("returns all when no version history", () => {
    const facts = [
      { id: "f1", text: "Alice likes tea", mentionedAt: "2024-01-01", entities: ["Alice"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
      { id: "f2", text: "Bob likes coffee", mentionedAt: "2024-02-01", entities: ["Bob"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
    ] as MemoryFact[];
    const result = preferLatestVersion(facts);
    expect(result).toHaveLength(2);
  });

  it("boosts recency for latest version", () => {
    const facts = [
      { id: "f1", text: "PostgreSQL 14", mentionedAt: "2024-01-01", supersedes: null, entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
      { id: "f2", text: "PostgreSQL 15", mentionedAt: "2024-02-01", supersedes: "f1", entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
    ] as MemoryFact[];
    const result = preferLatestVersion(facts);
    // f2 should have higher score than f1
    expect(result.find(f => f.id === "f2")?.recencyBoost).toBeGreaterThan(result.find(f => f.id === "f1")?.recencyBoost ?? 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/temporal-version.test.ts`
Expected: FAIL with "Cannot find module '../temporal-version'"

- [ ] **Step 3: Implement `preferLatestVersion`**

```typescript
// lib/engine/temporal-version.ts
import type { MemoryFact } from "@/lib/types";

export function preferLatestVersion(facts: MemoryFact[]): MemoryFact[] {
  // Group facts by primary entity
  const groups = new Map<string, MemoryFact[]>();
  for (const f of facts) {
    const key = f.entities[0] ?? f.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  const result: MemoryFact[] = [];
  for (const [, group] of groups) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }
    // Sort by mentionedAt descending, mark latest
    const sorted = [...group].sort((a, b) =>
      b.mentionedAt.localeCompare(a.mentionedAt)
    );
    // Boost recency for the latest, penalize superseded
    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i];
      const isLatest = i === 0;
      (f as any).recencyBoost = isLatest ? 1.5 : 0.7;
    }
    result.push(...sorted);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/engine/__tests__/temporal-version.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into recall.ts**

In `lib/engine/recall.ts`, after pool construction (line ~50), add:
```typescript
import { preferLatestVersion } from "./temporal-version";
// After: const pool = ...
const versionBoosted = preferLatestVersion(pool);
// Replace pool references with versionBoosted in the arms
```

- [ ] **Step 6: Commit**

```bash
git add lib/engine/temporal-version.ts lib/engine/__tests__/temporal-version.test.ts lib/engine/recall.ts
git commit -m "feat: temporal version preference — prefer latest version in recall"
```

---

## Task 2: Entity Scoping Isolation

**Files:**
- Modify: `lib/engine/recall.ts:50-70` (add pre-pass filter)
- Modify: `lib/engine/filters.ts` (add project_id — deferred to Task 5)
- Test: `lib/engine/__tests__/entity-scoping.test.ts`

**Interfaces:**
- Consumes: `MemoryFact.scopes.userId`, `MemoryFact.scopes.agentId`
- Produces: `applyEntityScoping(facts, scopes): MemoryFact[]` — filters facts to matching user/agent

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { applyEntityScoping } from "../recall"; // exported helper

describe("entity scoping isolation", () => {
  const facts = [
    { id: "f1", text: "Alice at Acme", scopes: { userId: "alice", agentId: "atlas" }, bankId: "b1", network: "world", confidence: 0.9, entities: [], tags: [], mentionedAt: "2024-01-01" },
    { id: "f2", text: "Bob at Beta", scopes: { userId: "bob", agentId: "atlas" }, bankId: "b1", network: "world", confidence: 0.9, entities: [], tags: [], mentionedAt: "2024-01-01" },
  ] as any[];

  it("filters to alice only when userId=alice", () => {
    const result = applyEntityScoping(facts, { userId: "alice" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("f1");
  });

  it("returns all when no userId set", () => {
    const result = applyEntityScoping(facts, {});
    expect(result).toHaveLength(2);
  });

  it("filters by both userId and agentId", () => {
    const result = applyEntityScoping(facts, { userId: "alice", agentId: "atlas" });
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/entity-scoping.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `applyEntityScoping` in recall.ts**

Add to `lib/engine/recall.ts`:
```typescript
export function applyEntityScoping(facts: MemoryFact[], scopes: { userId?: string; agentId?: string; appId?: string }): MemoryFact[] {
  if (!scopes.userId && !scopes.agentId && !scopes.appId) return facts;
  return facts.filter((f) => {
    if (scopes.userId && f.scopes?.userId && f.scopes.userId !== scopes.userId) return false;
    if (scopes.agentId && f.scopes?.agentId && f.scopes.agentId !== scopes.agentId) return false;
    if (scopes.appId && f.scopes?.appId && f.scopes.appId !== scopes.appId) return false;
    return true;
  });
}
```

In the `recall()` function, before pool construction:
```typescript
const scopedPool = applyEntityScoping(pool, input.scopes ?? {});
// use scopedPool instead of pool
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/engine/__tests__/entity-scoping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/recall.ts lib/engine/__tests__/entity-scoping.test.ts
git commit -m "feat: entity scoping isolation — auto-filter by user/agent in recall pre-pass"
```

---

## Task 3: Backend Persistence (PostgreSQL)

**Files:**
- Modify: `app/api/v1/memory/retain/route.ts`
- Modify: `app/api/v1/memory/recall/route.ts`
- Create: `lib/server/pg-client.ts` — PostgreSQL connection pool
- Modify: `.env.example` — add APEX_DATABASE_URL

**Interfaces:**
- `retainToPostgres(content, scopes): Promise<{ factId: string }>`
- `recallFromPostgres(query, scopes): Promise<MemoryFact[]>`

- [ ] **Step 1: Add pg dependency**

```bash
npm install pg
npm install -D @types/pg
```

- [ ] **Step 2: Create `lib/server/pg-client.ts`**

```typescript
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(): Pool | null {
  const url = process.env.APEX_DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000 });
  }
  return pool;
}

export async function ensureSchema() {
  const p = getPgPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS memory_facts (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      text TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT 'world',
      confidence REAL NOT NULL DEFAULT 0.5,
      scopes JSONB NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      entities TEXT[] NOT NULL DEFAULT '{}',
      mentioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_memory_facts_bank ON memory_facts(bank_id);
    CREATE INDEX IF NOT EXISTS idx_memory_facts_scopes ON memory_facts USING GIN (scopes);
  `);
}
```

- [ ] **Step 3: Wire retain route to PostgreSQL**

In `app/api/v1/memory/retain/route.ts`, after extracting content:
```typescript
const pool = getPgPool();
if (pool) {
  await ensureSchema();
  const factId = `fact-${Date.now()}`;
  await pool.query(
    `INSERT INTO memory_facts (id, bank_id, text, network, confidence, scopes, tags, entities)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [factId, bankId, content, "world", 0.8, JSON.stringify(scopes), tags, entities]
  );
  return NextResponse.json({ ok: true, data: { fact: { id: factId } } });
}
// Fallback: localStorage-only (no-op, client handles it)
return NextResponse.json({ ok: true, state: "localStorage-only" });
```

- [ ] **Step 4: Wire recall route to PostgreSQL**

In `app/api/v1/memory/recall/route.ts`:
```typescript
const pool = getPgPool();
if (pool) {
  const result = await pool.query(
    `SELECT * FROM memory_facts WHERE bank_id = $1 AND (scopes->>'userId' = $2 OR $2 IS NULL) ORDER BY mentioned_at DESC LIMIT $3`,
    [bankId, scopes?.userId ?? null, maxTokens ? Math.floor(maxTokens / 100) : 20]
  );
  return NextResponse.json({ ok: true, data: { facts: result.rows, traceId: `pg-${Date.now()}` } });
}
```

- [ ] **Step 5: Add graceful fallback**

If `APEX_DATABASE_URL` is not set, routes return `{ state: "localStorage-only" }` and the client continues using zustand store. No crash.

- [ ] **Step 6: Commit**

```bash
git add lib/server/pg-client.ts app/api/v1/memory/retain/route.ts app/api/v1/memory/recall/route.ts
git commit -m "feat: PostgreSQL backend persistence for memory retain/recall"
```

---

## Task 4: Auto-Project Detection (already partially done)

**Files:** Already implemented in Task 0 (project-detector.ts + store wiring + UI). Verify and enhance.

- [ ] **Step 1: Add project_id to MemoryScopes type**

In `lib/types.ts`, add `projectId?: string` to `MemoryScopes`.

- [ ] **Step 2: Auto-create bank on retain (already done in memory/page.tsx)**

Verify the retain flow creates banks for detected projects.

- [ ] **Step 3: Add project selector to retain scopes UI**

In `app/sandbox/memory/page.tsx`, add a "Project" field to the scopes input grid.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts app/sandbox/memory/page.tsx
git commit -m "feat: project_id in scopes + auto-create bank on retain"
```

---

## Task 5: Cross-Project Contamination Guard

**Files:**
- Modify: `lib/engine/filters.ts` — add `project_id` to FILTER_FIELDS
- Modify: `lib/engine/filters.ts:83-102` — add project_id to fieldValue
- Modify: `lib/types.ts` — add project_id to FilterNode field list

**Interfaces:**
- `project_id` filter works like `user_id` — extracts from `fact.scopes.projectId`

- [ ] **Step 1: Add project_id to FILTER_FIELDS**

```typescript
export const FILTER_FIELDS = [
  "user_id", "agent_id", "app_id", "run_id", "project_id",
  // ... rest
] as const;
```

- [ ] **Step 2: Add project_id to fieldValue extraction**

```typescript
case "project_id": return fact.scopes?.projectId ?? null;
```

- [ ] **Step 3: Auto-apply project_id filter in recall when set**

In `lib/engine/recall.ts`, when `input.scopes.projectId` is set, add it to the auto-filters:
```typescript
if (input.scopes?.projectId) {
  filters = { ...filters, project_id: input.scopes.projectId };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/engine/__tests__/`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add lib/engine/filters.ts lib/engine/recall.ts lib/types.ts
git commit -m "feat: cross-project contamination guard — project_id filter dimension"
```

---

## Task 6: Real MCP Stdio Server

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/index.ts`
- Create: `mcp-server/tsconfig.json`

**Interfaces:**
- MCP tools: `retain`, `recall`, `reflect`, `list_banks`, `create_bank`
- Connects to PostgreSQL via APEX_DATABASE_URL

- [ ] **Step 1: Create mcp-server/package.json**

```json
{
  "name": "hindsight-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/pg": "^8.10.0"
  }
}
```

- [ ] **Step 2: Create mcp-server/index.ts**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Pool } from "pg";

const pool = process.env.APEX_DATABASE_URL ? new Pool({ connectionString: process.env.APEX_DATABASE_URL }) : null;

const server = new Server(
  { name: "hindsight-memory", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/list", async () => ({
  tools: [
    { name: "retain", description: "Store a memory fact", inputSchema: { type: "object", properties: { content: { type: "string" }, bankId: { type: "string" }, userId: { type: "string" } }, required: ["content"] } },
    { name: "recall", description: "Search memories", inputSchema: { type: "object", properties: { query: { type: "string" }, bankId: { type: "string" }, userId: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
    { name: "list_banks", description: "List all memory banks", inputSchema: { type: "object", properties: {} } },
  ],
}));

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "retain") {
    if (!pool) return { content: [{ type: "text", text: "PostgreSQL not configured. Set APEX_DATABASE_URL." }] };
    const factId = `fact-${Date.now()}`;
    await pool.query(
      `INSERT INTO memory_facts (id, bank_id, text, scopes) VALUES ($1, $2, $3, $4)`,
      [factId, args.bankId ?? "default", args.content, JSON.stringify({ userId: args.userId })]
    );
    return { content: [{ type: "text", text: `Retained: ${factId}` }] };
  }
  if (name === "recall") {
    if (!pool) return { content: [{ type: "text", text: "PostgreSQL not configured." }] };
    const result = await pool.query(
      `SELECT text, confidence FROM memory_facts WHERE bank_id = $1 ORDER BY mentioned_at DESC LIMIT $2`,
      [args.bankId ?? "default", args.limit ?? 10]
    );
    return { content: [{ type: "text", text: JSON.stringify(result.rows) }] };
  }
  if (name === "list_banks") {
    if (!pool) return { content: [{ type: "text", text: "[]" }] };
    const result = await pool.query(`SELECT DISTINCT bank_id FROM memory_facts`);
    return { content: [{ type: "text", text: JSON.stringify(result.rows.map(r => r.bank_id)) }] };
  }
  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 3: Build and test**

```bash
cd mcp-server && npm install && npm run build && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

- [ ] **Step 4: Commit**

```bash
git add mcp-server/
git commit -m "feat: real MCP stdio server for external agents"
```

---

## Task 7: Automated Audit Pipeline

**Files:**
- Modify: `package.json` — add `test:audit` script
- Create: `tests/e2e/audit-full.spec.ts` — consolidated suite
- Create: `.github/workflows/audit.yml` — CI gate

- [ ] **Step 1: Add test:audit script**

In `package.json`:
```json
"scripts": {
  "test:audit": "playwright test tests/e2e/audit-*.spec.ts --project=chromium"
}
```

- [ ] **Step 2: Create consolidated audit spec**

Combine all audit tests into `tests/e2e/audit-full.spec.ts` with deterministic seeding:
```typescript
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/sandbox/memory");
  // Clear localStorage for deterministic state
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
});

// ... all TM-* tests with seeded retain calls
```

- [ ] **Step 3: Create CI workflow**

```yaml
# .github/workflows/audit.yml
name: Memory Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run dev &
      - run: sleep 10 && npm run test:audit
```

- [ ] **Step 4: Commit**

```bash
git add package.json tests/e2e/audit-full.spec.ts .github/workflows/audit.yml
git commit -m "feat: automated audit pipeline with CI gate"
```

---

## Execution Order

1. Task 1 (Temporal) — independent, easy win
2. Task 2 (Entity scoping) — independent
3. Task 5 (Cross-project guard) — depends on Task 4's project_id
4. Task 4 (Auto-project detection) — enhance existing
5. Task 3 (PostgreSQL) — enables MCP + backend
6. Task 6 (MCP server) — depends on Task 3
7. Task 7 (Audit pipeline) — depends on all above

## Verification

After all tasks:
```bash
npx tsc --noEmit
npx vitest run
npm run test:audit
```
All must pass.