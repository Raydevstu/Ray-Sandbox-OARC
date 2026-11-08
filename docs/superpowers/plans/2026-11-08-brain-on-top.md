# Brain-on-Top Fusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add investigations, distilled knowledge with importance scoring, and a 1500-token context-pack builder on top of existing recall without breaking Postgres canonical store.

**Architecture:** Additive lib/engine modules hooking into existing retain/recall via pure functions. No changes to CanonicalRepository interface. Three new Postgres tables via migration. No vector deps, no new npm packages.

**Tech Stack:** TypeScript, Next.js 16, Vitest, existing hashed embed/BM25 in lib/engine/nlp.ts

**Spec:** Fusion docs: Repository Brain arch + Distillation Pipeline 10 stages + Ripwire context engine + Claude-Mem distillation + Agent-Browser text-first + Headroom compression principles. User constraint: 100% blueprint adherence, enterprise quality, no stubs, Tier-1 code, test + manual checklist.

## Global Constraints

- TypeScript strict, tsc --noEmit clean on every task.
- No stubs or placeholders: every exported function real and tested.
- No changes to lib/runtime/contracts.ts CanonicalRepository shape except additive optional fields.
- No new npm dependencies.
- Follow existing import alias @/lib/*.
- Every task ends with vitest green for its file plus tsc clean.

## Review Focus

- Distilled fact missing projectId scope leaks across projects — recall must still enforce project_id filter.
- Importance scorer returning NaN on empty text — must clamp 0-100.
- Context pack exceeding 1500 tokens on long facts — must hard-cap.
- Dedup merging unrelated facts with shared stopwords — must use entity overlap gate.
- Distillation worker dropping investigations with no resolution — must keep unresolved as open.

---

### Task 1: Investigations store + distillation worker core

**Files:**
- Create: `lib/engine/investigations.ts`
- Create: `lib/engine/distillation.ts`
- Test: `lib/engine/__tests__/investigations.test.ts`
- Test: `lib/engine/__tests__/distillation.test.ts`

**Interfaces:**
- Consumes: MemoryFact from @/lib/types, tokenize from ./nlp
- Produces: buildInvestigation(events: SessionEvent[]) => Investigation; extractFacts(inv: Investigation) => DistilledFact[]; distillSession(events) => DistilledFact[]

- [ ] **Step 1: Write failing test for buildInvestigation**

```typescript
import { buildInvestigation } from "../investigations";
test('groups session events into investigation with files and task', () => {
  const inv = buildInvestigation({ task: "Investigate Login Timeout", events: [
    { type: "FILE_VIEWED", file: "AuthService.ts", timestamp: 1 },
    { type: "FILE_MODIFIED", file: "AuthService.ts", timestamp: 2 },
    { type: "TEST_RUN", file: "auth.spec.ts", timestamp: 3 },
  ]});
  expect(inv.task).toBe("Investigate Login Timeout");
  expect(inv.filesTouched).toContain("AuthService.ts");
  expect(inv.tests).toContain("auth.spec.ts");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/investigations.test.ts`
Expected: FAIL with "Cannot find module '../investigations'"

- [ ] **Step 3: Implement `buildInvestigation(input)`, `extractFacts(inv)`, `distillSession(events)` in exact files**

Signatures:
`export interface SessionEvent { type: string; file?: string; timestamp: number; content?: string }`
`export interface Investigation { id: string; task: string; filesTouched: string[]; tests: string[]; findings: string[]; resolution?: string }`
`export interface DistilledFact { entity: string; category: "architecture"|"workflow"|"dependency"|"risk"|"failure"|"solution"; content: string; confidence: number; importance: number; occurrences: number }`
`export function buildInvestigation(input: { task: string; events: SessionEvent[]; findings?: string[]; resolution?: string }): Investigation`
`export function extractFacts(inv: Investigation): DistilledFact[]`
`export function distillSession(input: { task: string; events: SessionEvent[]; findings?: string[]; resolution?: string }): DistilledFact[]`

extractFacts rules (real, no stub): derive entity from most common file basename without extension; category failure if task contains fail/error/bug/timeout/logout else workflow; content `${task} — files: ${filesTouched.join(", ")}` plus resolution when present; confidence 0.8 with resolution else 0.55; importance computed by calculateImportance below in Task 2 (import it to avoid dup); occurrences 1.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/engine/__tests__/investigations.test.ts lib/engine/__tests__/distillation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/investigations.ts lib/engine/distillation.ts lib/engine/__tests__/investigations.test.ts lib/engine/__tests__/distillation.test.ts
git commit -m "feat: investigations store and distillation worker core"
```

### Task 2: Importance scoring + dedup + aging + merger

**Files:**
- Create: `lib/engine/importance.ts`
- Test: `lib/engine/__tests__/importance.test.ts`

**Interfaces:**
- Consumes: DistilledFact from ./distillation
- Produces: calculateImportance(f, ctx?) => number; mergeDuplicates(facts) => DistilledFact[]; applyAging(facts, nowMs?) => DistilledFact[]

- [ ] **Step 1: Write failing test**

```typescript
import { calculateImportance, mergeDuplicates } from "../importance";
test('scores AuthService fact high and README low', () => {
  const high = calculateImportance({ entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh", confidence: 0.9, importance: 0, occurrences: 3 });
  const low = calculateImportance({ entity: "readme", category: "workflow", content: "README title", confidence: 0.3, importance: 0, occurrences: 1 });
  expect(high).toBeGreaterThan(low);
  expect(high).toBeLessThanOrEqual(100);
});
test('merges duplicate JWT refresh facts', () => {
  const merged = mergeDuplicates([
    { entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh", confidence: 0.9, importance: 90, occurrences: 1 },
    { entity: "AuthService", category: "workflow", content: "JWT refresh handled in AuthService", confidence: 0.8, importance: 85, occurrences: 1 },
  ]);
  expect(merged.length).toBe(1);
  expect(merged[0].occurrences).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/importance.test.ts`
Expected: FAIL with "Cannot find module '../importance'"

- [ ] **Step 3: Implement `calculateImportance`, `mergeDuplicates`, `applyAging` in `lib/engine/importance.ts`**

Formula (exact): architectureImpact 0-40 (entity length>4 + file-ish + category weight) + dependencyImpact 0-25 (occurrences*8 capped) + taskFrequency 0-20 (occurrences*6 capped) + recency 0-10 (default 10) + confidence 0-10 (confidence*10). Clamp 0-100, NaN-safe, empty content returns 5. Dedup: normalize lowercase strip non-alnum, token overlap >=0.5 AND same entity (case-insensitive) required to merge; merged keeps higher importance, sums occurrences, keeps longer content. Aging: effectiveScore = importance * (1 + log10(1+occurrences)) * recencyFactor where recencyFactor 1.0 default; facts with importance<15 and occurrences<=1 marked archived via returned filtered list (drop them).

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/engine/__tests__/importance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/importance.ts lib/engine/__tests__/importance.test.ts
git commit -m "feat: importance scoring dedup and aging"
```

### Task 3: Context-pack builder 1500-token hybrid retrieval

**Files:**
- Create: `lib/engine/context-pack.ts`
- Test: `lib/engine/__tests__/context-pack.test.ts`

**Interfaces:**
- Consumes: DistilledFact, Investigation, EntityRecord from ./entities, tokenize/embed/cosine from ./nlp
- Produces: buildContextPack(input) => ContextPack; rankFacts(query, facts, entities?) => RankedFact[]

- [ ] **Step 1: Write failing test**

```typescript
import { buildContextPack } from "../context-pack";
test('builds capped pack with relevant facts first', () => {
  const pack = buildContextPack({ task: "Fix login timeout", query: "login timeout",
    facts: [
      { entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh tokens", confidence: 0.9, importance: 95, occurrences: 3 },
      { entity: "readme", category: "workflow", content: "unrelated notes", confidence: 0.3, importance: 12, occurrences: 1 },
    ], investigations: [], maxTokens: 1500 });
  expect(pack.task).toBe("Fix login timeout");
  expect(pack.facts[0].entity).toBe("AuthService");
  expect(pack.tokensUsed).toBeLessThanOrEqual(1500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/context-pack.test.ts`
Expected: FAIL with "Cannot find module '../context-pack'"

- [ ] **Step 3: Implement `buildContextPack` and `rankFacts` in `lib/engine/context-pack.ts`**

Signatures:
`export interface ContextPack { task: string; architectureFacts: string[]; previousSolutions: string[]; relevantFiles: string[]; dependencies: string[]; risks: string[]; facts: DistilledFact[]; tokensUsed: number }`
`export function rankFacts(query: string, facts: DistilledFact[]): DistilledFact[]`
`export function buildContextPack(input: { task: string; query: string; facts: DistilledFact[]; investigations?: Investigation[]; entities?: { name: string; cooccur: { entity: string }[] }[]; maxTokens?: number }): ContextPack`

Ranking (exact): score = keywordOverlap*3 + entityMatch*2 + importance/25 + confidence; keywordOverlap = shared tokens between query and fact content via tokenize; entityMatch = 1 if query tokens intersect entity tokens. Sort desc, take top 15. Token cap: countTokens = ceil(chars/4); pack facts in rank order until maxTokens (default 1500) reached, hard stop. architectureFacts = packed workflow/architecture contents; previousSolutions = solution category contents; risks = risk/failure contents; relevantFiles/dependencies derived from content file-like tokens (*.ts etc) else entity names.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/engine/__tests__/context-pack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/context-pack.ts lib/engine/__tests__/context-pack.test.ts
git commit -m "feat: context pack builder with hybrid ranking"
```

### Task 4: Wire into recall retain MCP and verify

**Files:**
- Modify: `lib/engine/recall.ts` (add optional distilled input + pack passthrough, no signature break)
- Modify: `lib/engine/retain.ts` (export hook distillRetainInput, no behavior change)
- Modify: `mcp-server/index.ts` (add context_pack tool, keep existing 5)
- Test: `lib/engine/__tests__/fusion-wire.test.ts`

**Interfaces:**
- Consumes: buildContextPack from ./context-pack, distillSession from ./distillation
- Produces: recallWithPack(input) helper; MCP tool context_pack

- [ ] **Step 1: Write failing wire test**

```typescript
import { recall } from "../recall";
test('recall still works when distilled pack passed alongside', async () => {
  const res: any = await recall({ query: "login timeout", facts: [], links: [], observations: [], opinions: [],
    settings: { budgetMode: "fixed", budget: "mid" } as any, distilledFacts: [] } as any);
  expect(res).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npx vitest run lib/engine/__tests__/fusion-wire.test.ts`
Expected: FAIL (distilledFacts unknown) or PASS with ignore — either way proceed to wire so recall accepts and ignores gracefully, and pack helper exists.

- [ ] **Step 3: Implement wiring**

In recall.ts: extend RecallInput with optional `distilledFacts?: import("./distillation").DistilledFact[]`; if present and non-empty, run buildContextPack and attach `(result as any).contextPack`. No change to ranking when absent. In retain.ts: export `distillRetainInput(text: string, files?: string[]): import("./distillation").DistilledFact[]` that builds SessionEvents from files and calls distillSession. In mcp-server/index.ts: add 6th tool `context_pack` taking { task, query, facts } returning pack JSON via buildContextPack. All real, no stub.

- [ ] **Step 4: Run full verification**

Run: `npx vitest run lib/engine/__tests__/investigations.test.ts lib/engine/__tests__/distillation.test.ts lib/engine/__tests__/importance.test.ts lib/engine/__tests__/context-pack.test.ts lib/engine/__tests__/fusion-wire.test.ts`
Expected: PASS all. Then `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/recall.ts lib/engine/retain.ts mcp-server/index.ts lib/engine/__tests__/fusion-wire.test.ts
git commit -m "feat: wire brain-on-top into recall retain and MCP"
```
