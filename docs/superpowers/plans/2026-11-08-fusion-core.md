# Fusion Core 2-1-3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biggest core gains in order: (2) memory lifecycle completion, (1) retrieval upgrade, (3) decision trace. Additive only, no CanonicalRepository rewrite, no new deps.

**Architecture:** Pure lib/engine modules hooking retain/recall. Lifecycle handles supersede/conflict + decay + nightly consolidation + provenance. Retrieval blends keyword + entity + graph-neighbour + hashed-embed semantic into rankFacts. Trace records router decision + pack with per-item why + outcome.

**Tech Stack:** TypeScript, Next.js 16, Vitest, existing lib/engine/nlp.ts tokenize/embed/cosine, existing MemoryFact/GraphLink types.

**Spec:** Apex fusion blueprint: tiers with provenance, retrieval ranked by relevance x importance x recency with fixed budget, lifecycle dedup/supersede/decay/consolidate nightly, decision trace with why-included + accept/edit/revert outcome, skill injection deferred.

## Global Constraints

- TypeScript strict, tsc --noEmit clean every task.
- No stubs: every export real and tested.
- No changes to CanonicalRepository shape except optional additive fields.
- No new npm dependencies, reuse nlp.ts hashed embed.
- Follow @/lib/* alias, enterprise Tier-1 quality.
- Every task ends vitest green + tsc clean.

## Review Focus

- Supersede deleting unrelated facts with shared stopwords — must require entity match + contradiction cue.
- Decay zeroing fresh high-importance facts — must be time-gated and floor-protected.
- Graph expansion exploding pack with distant neighbours — must cap depth 1 + top 3 neighbours.
- Semantic fallback outranking exact keyword on typos — must weight exact higher.
- Trace storing raw prompt text with secrets — must store hashes/lengths, not raw PII.

---

### Task 1: Memory lifecycle — supersede + decay + consolidation + provenance

**Files:**
- Create: `lib/engine/memory-lifecycle.ts`
- Test: `lib/engine/__tests__/memory-lifecycle.test.ts`

**Interfaces:**
- Consumes: DistilledFact from ./distillation
- Produces: supersedeFacts(facts) => DistilledFact[]; decayScores(facts, nowMs?) => DistilledFact[]; consolidateNightly(investigations) => DistilledFact[]; withProvenance(fact, source) => DistilledFact & { provenance: Provenance }

- [ ] **Step 1: Write failing test for supersede + decay + consolidation**

```typescript
import { supersedeFacts, decayScores, consolidateNightly } from "../memory-lifecycle";
test('supersedes contradicted fact and keeps newer', () => {
  const out = supersedeFacts([
    { entity: "AuthService", category: "workflow", content: "AuthService uses localStorage", confidence: 0.6, importance: 60, occurrences: 2 },
    { entity: "AuthService", category: "workflow", content: "AuthService uses httpOnly cookies, not localStorage", confidence: 0.9, importance: 85, occurrences: 1 },
  ]);
  expect(out.length).toBe(1);
  expect(out[0].content).toMatch(/httpOnly/);
});
test('decay protects fresh high-importance', () => {
  const now = Date.now();
  const out = decayScores([
    { entity: "Auth", category: "workflow", content: "x", confidence: 0.9, importance: 95, occurrences: 5 },
  ], now);
  expect(out[0].importance).toBeGreaterThan(80);
});
test('nightly consolidation merges one domain', () => {
  const out = consolidateNightly([{ id: "1", task: "Fix login", filesTouched: ["AuthService.ts"], tests: [], findings: ["race"], resolution: "retry" }]);
  expect(out.length).toBe(1);
  expect(out[0].provenance).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/memory-lifecycle.test.ts`
Expected: FAIL with "Cannot find module '../memory-lifecycle'"

- [ ] **Step 3: Implement `supersedeFacts`, `decayScores`, `consolidateNightly`, `withProvenance` in exact file**

Signatures:
`export interface Provenance { source: string; commit?: string; turnId?: string; createdAt: number }`
`export function withProvenance<T extends object>(fact: T, source: Omit<Provenance,"createdAt"> & { createdAt?: number }): T & { provenance: Provenance }`
`export function supersedeFacts(facts: DistilledFact[]): DistilledFact[]`
`export function decayScores(facts: DistilledFact[], nowMs?: number): DistilledFact[]`
`export function consolidateNightly(investigations: Investigation[]): DistilledFact[]`

Rules (real): supersede groups by lowercased entity, contradiction cue = /not |no longer|instead|replaces|migrated|deprecated/i OR (same entity + token overlap>=0.4 + confidence delta>=0.2 keeps higher confidence, merges occurrences). decay: ageDays from provenance.createdAt or 0, factor = 1/(1+ageDays/30), floor = importance>=80 && occurrences>=3 ? 80 : 10, newImportance = max(floor, round(importance*factor + occurrences*2)). Consolidation: group investigations by first filesTouched entity or task keyword, produce one DistilledFact per group with merged content, importance = max, occurrences = sum, provenance source nightly.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run lib/engine/__tests__/memory-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/memory-lifecycle.ts lib/engine/__tests__/memory-lifecycle.test.ts
git commit -m "feat: memory lifecycle supersede decay consolidation provenance"
```

### Task 2: Retrieval upgrade — graph-neighbour + semantic blended ranking

**Files:**
- Modify: `lib/engine/context-pack.ts` (extend rankFacts signature backwards-compatible)
- Test: `lib/engine/__tests__/retrieval-upgrade.test.ts`

**Interfaces:**
- Consumes: DistilledFact, tokenize/embed/cosine from ./nlp, GraphLink shape { from, to }
- Produces: rankFacts(query, facts, opts?) with opts { entities?, links?, semanticWeight? }

- [ ] **Step 1: Write failing test**

```typescript
import { rankFacts } from "../context-pack";
test('graph neighbour lifts related file fact', () => {
  const ranked = rankFacts("login timeout", [
    { entity: "LoginPage", category: "workflow", content: "LoginPage shows spinner", confidence: 0.6, importance: 50, occurrences: 1 },
    { entity: "AuthService", category: "workflow", content: "AuthService refreshes JWT", confidence: 0.9, importance: 60, occurrences: 1 },
  ], { links: [{ from: "LoginPage", to: "AuthService" }], entities: [{ name: "AuthService", cooccur: [] }] });
  expect(ranked[0].entity).toBe("AuthService");
});
test('semantic fallback matches wording mismatch', () => {
  const ranked = rankFacts("sign-in hangs", [
    { entity: "readme", category: "workflow", content: "unrelated gardening notes", confidence: 0.3, importance: 10, occurrences: 1 },
    { entity: "AuthService", category: "workflow", content: "login authentication timeout handling", confidence: 0.8, importance: 70, occurrences: 1 },
  ]);
  expect(ranked[0].entity).toBe("AuthService");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/retrieval-upgrade.test.ts`
Expected: FAIL (opts unsupported or ranking wrong)

- [ ] **Step 3: Implement extended `rankFacts` in `lib/engine/context-pack.ts`**

Keep signature `rankFacts(query, facts, opts?)` backwards compatible. Scoring: keywordOverlap*3 + entityMatch*2 + importance/25 + confidence + graphBoost + semanticBoost. graphBoost: if fact.entity in 1-hop neighbours of any direct keyword-matched entity via links (case-insensitive), +2.5, cap to top 3 neighbours. semanticBoost: cosine(embed(query), embed(fact.content)) * 1.5 using existing nlp embed/cosine, only when keywordOverlap==0 (fallback, never outranks exact). Depth 1 only.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/engine/__tests__/retrieval-upgrade.test.ts lib/engine/__tests__/context-pack.test.ts`
Expected: PASS both

- [ ] **Step 5: Commit**

```bash
git add lib/engine/context-pack.ts lib/engine/__tests__/retrieval-upgrade.test.ts
git commit -m "feat: retrieval graph neighbour plus semantic fallback"
```

### Task 3: Decision trace with why-included + outcome

**Files:**
- Create: `lib/engine/decision-trace.ts`
- Test: `lib/engine/__tests__/decision-trace.test.ts`

**Interfaces:**
- Consumes: ContextPack from ./context-pack
- Produces: recordTrace(input) => DecisionTrace; scoreAcceptance(traces) => number

- [ ] **Step 1: Write failing test**

```typescript
import { recordTrace, scoreAcceptance } from "../decision-trace";
test('trace keeps per-item reasons without raw PII', () => {
  const t = recordTrace({ query: "fix login", task: "fix login",
    pack: { task: "fix login", architectureFacts: [], previousSolutions: [], relevantFiles: [], dependencies: [], risks: [], facts: [
      { entity: "AuthService", category: "workflow", content: "secret abc", confidence: 0.9, importance: 95, occurrences: 1 },
    ], tokensUsed: 10 }, model: "local", tokens: 10 });
  expect(t.items[0].why).toMatch(/keyword|entity|importance|graph|semantic/);
  expect(JSON.stringify(t)).not.toMatch(/secret abc/);
});
test('acceptance score counts unedited accepts', () => {
  expect(scoreAcceptance([{ outcome: "accepted" }, { outcome: "edited" }, { outcome: "accepted" }] as any)).toBeCloseTo(0.66, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/__tests__/decision-trace.test.ts`
Expected: FAIL with "Cannot find module '../decision-trace'"

- [ ] **Step 3: Implement `recordTrace`, `scoreAcceptance` in `lib/engine/decision-trace.ts`**

Signatures:
`export interface TraceItem { entity: string; score: number; why: string; contentHash: string; contentLength: number }`
`export interface DecisionTrace { id: string; queryHash: string; task: string; model: string; tokens: number; items: TraceItem[]; outcome?: "accepted"|"edited"|"reverted"; createdAt: number }`
`export function recordTrace(input: { query: string; task: string; pack: ContextPack; model: string; tokens: number }): DecisionTrace`
`export function scoreAcceptance(traces: Pick<DecisionTrace,"outcome">[]): number`

Rules: queryHash = simple fnv1a hex of query (no raw query stored beyond task label). Per item: recompute why from rank signals (keyword overlap / entity match / graph / semantic / importance), contentHash fnv1a, contentLength only, never raw content. scoreAcceptance = accepted / total with outcome defined, 0 when empty.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/engine/__tests__/decision-trace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/decision-trace.ts lib/engine/__tests__/decision-trace.test.ts
git commit -m "feat: decision trace with why-included and acceptance"
```
