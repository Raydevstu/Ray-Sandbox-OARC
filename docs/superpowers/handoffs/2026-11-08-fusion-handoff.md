# Handoff — Fusion branch, Brain-on-Top + Core 2-1-3 DONE

Date: 2026-11-08. Branch `Fusion` pushed to origin. Tree clean at 979f225 + handoff commit.

## Where we are
- Branch: `Fusion` (snapshot 6dde406 pre-fusion fallback intact). Fallback branch `codex/preserve-hermes-runtime-2026-10-23` untouched.
- All 3 ordered builds DONE: (2) memory lifecycle, (1) retrieval upgrade, (3) decision trace. TDD every task, tsc clean, build ok, 397 pass / 6 skip.
- Docs DONE: README fusion section + `docs/fusion-guide.md` (workflow, usage snippets, 12-step checklist, measured table, limits).

## Commits on top of 6dde406 (oldest→newest)
1. c284cf8 investigations + distillation core
2. 7975b74 importance scoring dedup aging
3. 103cf60 context pack builder hybrid ranking
4. 6c8524b wire brain-on-top into recall retain MCP
5. 03d066d fix importance scorer input type
6. dedff29 lifecycle supersede decay consolidation provenance
7. f1c22d5 fix duplicate createdAt in withProvenance
8. c05d98e retrieval graph neighbour + semantic fallback
9. 52c06f0 decision trace with why-included + acceptance
10. 979f225 docs README + fusion guide

## New files
- lib/engine/investigations.ts, distillation.ts, importance.ts, context-pack.ts, memory-lifecycle.ts, decision-trace.ts, temporal-version.ts, project-detector.ts, auto-import.ts (last three from earlier phase)
- Tests: __tests__/investigations, distillation, importance, context-pack, fusion-wire, memory-lifecycle, retrieval-upgrade, decision-trace
- docs/superpowers/plans/2026-11-08-brain-on-top.md, docs/superpowers/plans/2026-11-08-fusion-core.md
- Ledgers: .superpowers/sdd/2026-11-08-brain-on-top/progress.md, .superpowers/sdd/2026-11-08-fusion-core/progress.md
- docs/fusion-guide.md

## Key interfaces (exact)
- `buildInvestigation({task, events})`, `distillSession({task, events, findings, resolution})`, `extractFacts(inv)`
- `calculateImportance(f)`, `mergeDuplicates(facts)`, `applyAging(facts, nowMs?)`
- `rankFacts(query, facts, {links?, entities?, semanticWeight?}?)`, `buildContextPack({task, query, facts, maxTokens})`
- `recall({... , distilledFacts?})` → `res.contextPack?`, `distillRetainInput(text, files)`
- `supersedeFacts(facts)`, `decayScores(facts, nowMs?)`, `consolidateNightly(invs)`, `withProvenance(fact, source)`
- `recordTrace({query, task, pack, model, tokens})`, `scoreAcceptance(traces)`, `fnv1a(text)`

## Measured (tsx probe, real code)
Retrieval 67%→83% (6q), dedup 10→6, pack 9930→1324 tokens /87%, distill 6ev→1fact /45%, supersede 2→1, decay stale 40→15 fresh held 100, trace 0 leaks, importance 86 vs 50.

## Known pending (NOT started)
1. Postgres migration for lifecycle/trace tables + nightly cron worker (in-memory only now).
2. Why-included UI panel in sandbox memory page.
3. Vectors/skill-registry/impact-selection/verification-gate (future).
4. Docker rebuild post-Fusion to re-verify currency (build passed pre-docs; rerun `docker-compose build app` + `up -d`).
5. Full suite + build re-run at next session start (last green: 397 pass, tsc clean).

## Resume commands (next chat)
```
cd "D:/Projects/RAY SANDBOX OWEN/hindsight-memory-slice"
git checkout Fusion && git pull origin Fusion
npx tsc --noEmit && npx vitest run 2>&1 | tail -3
```
Then pick: Postgres migration → trace UI → docker rebuild, or new feature.

## Credentials note
APEX_DATABASE_URL in docker-compose contains secrets; always present as [REDACTED].
