# Fusion Guide — Brain-on-Top + Core 2-1-3

How the new memory layer works, how to use each piece, and the end-to-end workflow. Branch: Fusion.

## 1. Concepts in one minute

- Investigation: one work session (task + files viewed/modified + tests + findings + resolution).
- DistilledFact: one durable unit (entity, category, content, confidence, importance, occurrences).
- Importance: 0-100 score (architecture 40 + dependency 25 + frequency 20 + recency 10 + confidence 10).
- Context pack: top-15 ranked facts squeezed into a 1500-token budget with architecture/solutions/risks/files split out.
- Provenance: where a fact came from (source, commit, turnId, createdAt).
- Decision trace: what the router picked and why, stored as hashes so no raw secrets leak.

## 2. End-to-end workflow

```
session events
  → buildInvestigation({ task, events })
  → distillSession({ task, events, findings, resolution })
  → calculateImportance per fact
  → mergeDuplicates → supersedeFacts → decayScores
  → consolidateNightly(investigations) for the daily rollup
  → rankFacts(query, facts, { links }) — keyword + entity + graph + semantic
  → buildContextPack({ task, query, facts, maxTokens: 1500 })
  → recall({ ..., distilledFacts }) → res.contextPack
  → recordTrace({ query, task, pack, model, tokens }) → outcome accepted/edited/reverted
  → scoreAcceptance(traces) tracks unedited-accept rate
```

## 3. How to use each function

### Investigations
```ts
import { buildInvestigation } from "@/lib/engine/investigations";
const inv = buildInvestigation({ task: "Investigate Login Timeout", events: [
  { type: "FILE_VIEWED", file: "AuthService.ts", timestamp: 1 },
  { type: "FILE_MODIFIED", file: "AuthService.ts", timestamp: 2 },
  { type: "TEST_RUN", file: "auth.spec.ts", timestamp: 3 },
]});
// inv.filesTouched = ["AuthService.ts"], inv.tests = ["auth.spec.ts"]
```

### Distillation
```ts
import { distillSession, extractFacts } from "@/lib/engine/distillation";
const facts = distillSession({ task: "Fix random logout",
  events: [...], findings: ["refresh token race"], resolution: "retry refresh" });
// facts[0] = { entity: "AuthService", category: "solution", confidence: 0.8, importance, occurrences: 1 }
import { distillRetainInput } from "@/lib/engine/retain";
const fromText = distillRetainInput("long transcript text here", ["AuthService.ts"]);
```

### Importance / dedup / aging
```ts
import { calculateImportance, mergeDuplicates, applyAging } from "@/lib/engine/importance";
calculateImportance({ entity: "AuthService", category: "workflow", content: "...", confidence: 0.9, occurrences: 3 }); // 0-100
mergeDuplicates(facts); // same entity + category + overlap>=0.5 merge, occurrences sum
applyAging(facts, Date.now()); // drops importance<15 singletons, sorts by effective score
```

### Lifecycle
```ts
import { supersedeFacts, decayScores, consolidateNightly, withProvenance } from "@/lib/engine/memory-lifecycle";
supersedeFacts(facts); // contradicted pair (not/no longer/instead/replaces) collapses to newer
decayScores(facts, Date.now()); // 1/(1+ageDays/30), floor 80 when importance>=80 && occurrences>=3
consolidateNightly(investigations); // one fact per domain with provenance { source: "nightly" }
withProvenance(fact, { source: "retain", commit: "abc123" });
```

### Retrieval + pack
```ts
import { rankFacts, buildContextPack } from "@/lib/engine/context-pack";
rankFacts("login timeout", facts); // baseline keyword+entity+importance
rankFacts("AuthService login", facts, { links: [{ from: "AuthService", to: "Target" }] }); // neighbour +2.5
const pack = buildContextPack({ task: "Fix login", query: "login timeout", facts, maxTokens: 1500 });
// pack = { architectureFacts, previousSolutions, relevantFiles, dependencies, risks, facts, tokensUsed<=1500 }
```

### Recall wire
```ts
import { recall } from "@/lib/engine/recall";
const res: any = await recall({ query, facts, links, observations, opinions, settings, distilledFacts });
res.contextPack; // present only when distilledFacts non-empty, otherwise undefined (old path untouched)
```

### Decision trace
```ts
import { recordTrace, scoreAcceptance } from "@/lib/engine/decision-trace";
const t = recordTrace({ query, task, pack, model: "local", tokens: pack.tokensUsed });
// t.items[0] = { entity, score, why: "keyword+2,entity,importance", contentHash, contentLength }
scoreAcceptance([{ outcome: "accepted" }, { outcome: "edited" }]); // 0.5
```

### MCP tool (external agents)
Tool `context_pack`, input `{ task?, query, facts: JSON string | array }`, returns `{ task, facts: packed, tokensUsed }`. Local ranking only, 1500 cap, no DB needed.

### Project automation
- `project-detector.ts`: infers project from file paths, memory page shows badge and auto-creates bank.
- `auto-import.ts`: file monitor with SHA dedup. Toggle + path in sandbox Settings → auto-import card.
- `project_id`: filter DSL dimension, auto-applied on recall, cross-project guard strictly filters (unscoped facts never leak into scoped queries).

## 4. Run it

```bash
npm install
npm run dev            # → http://localhost:3000
docker-compose up -d   # postgres :5434, app :3018 (needs APEX_DATABASE_URL)
npm run test           # full vitest suite (397 pass / 6 skip)
npx tsc --noEmit       # must be clean
npm run build          # production bundle
npm run test:audit     # Playwright audit-full.spec.ts (5/5)
```

## 5. Manual verification checklist

1. Dev server boots with no console errors on /sandbox/memory.
2. Retain a transcript mentioning a project path → bank auto-creates, badge appears.
3. `buildInvestigation` with 3 events → filesTouched + tests correct.
4. `distillSession` with resolution → confidence 0.8, category solution.
5. `mergeDuplicates` on 10 facts with 4 dup pairs → 6 out, occurrences summed, cross-entity untouched.
6. `supersedeFacts` localStorage vs httpOnly-not-localStorage → 1 fact, keeps httpOnly.
7. `decayScores` stale 40 → ~15, fresh 95/occ5 → stays ≥80.
8. `buildContextPack` with 30 long facts → tokensUsed ≤1500, AuthService first for login query.
9. `recall` with distilledFacts → contextPack present; without → undefined, old ranking unchanged.
10. `recordTrace` with secret content → JSON contains no secret raw, items[0].why matches keyword/entity/importance/semantic.
11. MCP `context_pack` via playground → packed JSON under 1500 tokens.
12. `docker-compose build app` still green (no new deps).

## 6. Measured improvements (this branch, tsx probe)

| Area | Before | After |
|---|---|---|
| Retrieval top-1 (6 queries) | 4/6 = 67% | 5/6 = 83% |
| Dedup (10 facts, 4 dup pairs) | 10 kept | 6 kept, 4 merged |
| Pack (30 long facts) | 9930 raw tokens | 1324 used, 4 packed, 87% compressed |
| Distill (6 events) | 411 chars raw | 1 fact 225 chars, 45% smaller |
| Supersede | 2 contradicting kept | 1 kept (newer) |
| Decay | stale stays 40 | stale → 15, fresh held 100 |
| Trace PII | n/a | 0 leaks, why kept |
| Consolidation | 2 investigations | 1 fact with provenance |
| Suite | — | 397 pass / 6 skip, tsc clean, build ok |

## 7. Limits (honest)

- Lifecycle/trace are in-memory engine only; no Postgres migration yet, no nightly cron wired.
- No UI panel for why-included trace yet; inspect via recall result / MCP playground.
- Semantic is hashed-embed fallback, not a real embedding model; exact matches always outrank it by design.
- Vectors, skill registry, impact/test-selection, verification gate are future work, not in this guide.
