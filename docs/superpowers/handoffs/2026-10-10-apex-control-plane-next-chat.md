# Apex Control Plane — New Chat Handoff

Date: 2026-10-10
Project: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`
Branch: `renewal-roadmaps`
Current authority: `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`

## Mission

Continue the Tier-1 Evidence-Driven Agent Memory Control Plane without recreating existing work, weakening evidence labels, or touching frozen external-deployment scope.

## Read order

1. `AGENTS.md`
2. `docs/superpowers/PROJECT-CORE-HEART.md`
3. `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`
4. `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
5. this handoff

## Current evidence position

- Local PostgreSQL, durable evidence, event-ledger, Memory Trace, review/policy foundations, local SLO scripts, adversarial evaluator, and production-like Docker validation exist.
- A deterministic 512-case adversarial report, local provenance audit, retain/recall workload, dead-letter drill, backup-manifest verification, and authenticated browser coverage have prior local evidence.
- Real desktop session evidence exists for user/assistant capture, tool result, command failure, cancellation UI, retry, duplicate-safe processing, and Memory Trace lineage; raw lifecycle cancellation detail remains a product visibility gap.
- Local evidence is not external production evidence. Provider extraction quality, external rollback/RPO/RTO, managed credentials, and live non-Codex connectors remain frozen or pending.

## Active implementation boundary

Implement only **Slice 1 — Enterprise Evidence Integrity Baseline** unless the user explicitly changes scope.

Required work, in order:

1. Inspect existing quality scripts, contracts, PostgreSQL repositories, and current tests.
2. Expand the SLO workload into a meaningful sustained measured workload; preserve p50/p95/p99, failures, queue delay, and worker-completion reporting.
3. Make provenance audit exhaustive for all in-scope derived memory records.
4. Make mutation-to-event-ledger audit exhaustive for all in-scope durable mutations.
5. Add explicit dead-letter replay-to-complete verification where the current path is incomplete.
6. Finish authenticated review/events/manifest/export browser journey and 768px accessibility proof only where missing.
7. Update the roadmap with exact commands, measurements, evidence limits, and remaining gaps.

## Required validation

Run focused checks before broad checks. Use the relevant subset of:

```powershell
npm test -- tests/runtime/quality-audit.test.ts tests/runtime/project-worker.test.ts
npm run typecheck
npm run quality:audit:postgres
npm run quality:slo:workload
npm run quality:adversarial:report
npm run test:e2e
npm run staging:validate
```

Use Docker/PostgreSQL staging only when needed:

```powershell
docker compose -f docker-compose.staging.yml up -d --build
```

Do not run external deployment, provider configuration, connector authorization, destructive cleanup, or credential operations.

## Operating rules

- Preserve the dirty worktree. Do not reset, clean, overwrite, relocate, or commit unrelated changes.
- Never print secrets, `.env` values, JWTs, raw transcripts, or customer content.
- Keep PostgreSQL canonical and retain immutable evidence links, timestamps, scope, confidence, policy state, idempotency, and event-ledger semantics.
- Label evidence exactly: `IMPLEMENTED`, `TESTED`, `LOCALLY VERIFIED`, `BROWSER VERIFIED`, `BENCHMARK VERIFIED`, `LIVE CONNECTOR VERIFIED`, or `PRODUCTION VERIFIED`.
- A build, local Docker container, HTTP success, or synthetic fixture does not prove live capture, browser workflow, benchmark quality, connector delivery, or external production.

## Completion criteria

The slice is complete only when a dated roadmap update contains:

- measured workload size and p50/p95/p99 results;
- exhaustive provenance and event-ledger audit totals;
- dead-letter replay evidence;
- focused and broader automated test results;
- browser/a11y evidence where changed;
- exact remaining gaps and one recommended next slice.

The expected next slice after successful completion is **Slice 2 — Typed Temporal Evidence Graph**.

## 2026-10-10 Slice 1 execution result

Slice 1 local evidence is recorded in the dated roadmap. The sustained workload measured 200 retain, 200 recall, and 200 durable Codex-event jobs with zero request failures; retain p50/p95/p99 `32.49/44.41/48.06ms`, recall p50/p95/p99 `43.41/67.05/77.00ms`, queue-delay p50/p95/p99 `0/0/0ms`, and worker completion `200/200` within 60 seconds with zero dead letters. PostgreSQL audit scanned `88` derived records and `631` events with `100%` provenance and mutation-ledger coverage. Focused runtime tests passed `18/18`, full Vitest passed `175` with `5` skipped, typecheck passed, and Playwright passed `12` with `2` skipped including authenticated 768px axe coverage.

The workload also confirmed a remaining integrity risk: concurrent retain writes can violate existing foreign keys because the retention repository path is not atomic. Retain evidence was therefore measured serially; atomic retain transaction hardening is pending. The review browser test remains skipped when staging has no reviewable record, and no separate export endpoint exists. No external deployment, provider credential, or live non-Codex connector evidence was produced.

## 2026-10-10 Slice 2 implementation checkpoint

Slice 2 implementation is in progress in the preserved dirty worktree. The graph domain now has aliases, deterministic resolution, temporal evidence-backed edges, reviewable contradiction detection, and bounded two-hop retrieval with complete explanation paths. Migration `0009_typed_graph.sql` adds scoped alias and conflict persistence; focused graph/repository/migration tests passed `11/11`. The final full-suite verification is still pending before Slice 2 can be marked complete. Slice 3 provider extraction has not been started.

## 2026-10-10 Slice 2 and Slice 3 implementation result

Slice 2 now includes the authenticated graph query route, database-enforced graph-edge evidence links, and explicit temporal/conflict regressions. Slice 3 now includes strict provider proposal validation, timeout/cost/candidate budgets, deterministic fallback, redacted telemetry, and policy-based approval routing. Focused graph/API/migration tests passed `13/13`; focused extraction/governance tests passed `14/14`. The remaining release evidence is a dedicated browser graph journey and authorized provider/human-reviewed quality measurement; external deployment, provider credentials, and live non-Codex connectors remain frozen.

Final local verification passed: `npm test` reported `186` passed and `5` skipped; typecheck passed; local staging was rebuilt with the graph route; and `npm run test:e2e` reported `12` passed and `2` skipped, with the authenticated graph API included in the 768px operator journey. The two skipped browser checks are the existing mobile review-mutation cases without a suitable seeded review record.

## 2026-10-10 Slice 4 implementation checkpoint

Slice 4 has a local durable foundation. `lib/runtime/evaluation-contract.ts` validates versioned corpus/config hashes and trace-linked cases, aggregates grounded accuracy, citation precision, unsupported claims, graph accuracy, p50/p95 latency, tokens, queue delay, cost, and cost per correct answer, classifies failed cases, and compares baseline/replay runs with absolute deltas and regression refusal. Migration `0010_evaluation_replay.sql` and both repository adapters persist scoped evaluation runs and replay comparisons.

Focused Slice 4 contract/repository/migration tests passed `10/10`; `npm run typecheck` passed. This is `IMPLEMENTED / TESTED` local evidence, not a benchmark-complete claim. Pending Slice 4 evidence is the versioned 500+ corpus manifest/results report, correction proposals and workflow replay from durable evidence, provider/human-reviewed measurements, browser coverage, live connector evidence, and production verification. Frozen external deployment and provider scope remains unchanged.

Next exact boundary: build the 500+ versioned Slice 4 manifest/results producer and persist a reproducible local report through the new evaluation repository methods.

## 2026-10-10 Slice 4 corpus producer result

The 500+ producer is now implemented in `lib/runtime/evaluation-producer.ts` and `scripts/slice-four-evaluation-report.mjs`, exposed as `npm run quality:slice4:report`. It produces 512 deterministic cases across temporal, graph, conflict, scope, deletion, and correction classes, writes [slice-4-evaluation-report.json](../../benchmarks/slice-4-evaluation-report.json), persists the complete run through `project_evaluation_runs`, and reads it back from local PostgreSQL.

The fixed-timestamp report is reproducible: grounded accuracy `1.000`, citation precision `1.000`, unsupported-claim rate `0.000`, graph accuracy `1.000`, p50/p95 latency `18/26ms`, total tokens `20,986`, average queue delay `1.994ms`, cost `$0.00`, and `512/512` correct cases. Repeated generation produced the same report hash. This is deterministic local benchmark evidence only; provider/human-reviewed quality, correction proposals, workflow replay, browser, live connector, and production evidence remain pending.

Next exact boundary: add durable failure classifications and correction proposals, replay the original workflow from stored evidence, and persist before/after comparison deltas.

## 2026-10-10 Slice 4 correction and replay result

Correction proposals and workflow replay are now implemented. `buildCorrectionProposals` preserves the failed case, failure categories, source run, and trace IDs. `createWorkflowReplay` requires project/source-run alignment and produces a complete comparison with absolute deltas and regression refusal. Migration `0011_evaluation_corrections.sql` and repository adapters persist proposals and workflow replays with scoped foreign keys.

`npm run quality:slice4:replay` persisted a deterministic failed baseline, correction proposal, improved replay run, comparison, and workflow replay. PostgreSQL readback confirmed one correction and one improved workflow replay. The fixture improved grounded accuracy by `+0.001953125` and reduced unsupported claims by `-0.001953125`, with no regressions in the other tracked metrics.

This remains deterministic local evidence only. Provider/human-reviewed quality, authenticated approval UI, browser, live connector, and production verification remain pending. Next exact boundary: add authenticated operator approval routing and broader replay fixtures for temporal, scope, deletion, and graph failures.

## 2026-10-10 Slice 4 replay coverage and safety result

Slice 4 replay coverage now includes deterministic fixtures for eleven governed failure categories: stale fact, wrong scope, temporal interpretation, entity resolution, contradiction, missing evidence, policy rejection, connector delivery, deletion, correction, and missing graph hop. The fixture factory preserves source trace IDs through baseline runs, correction proposals, replay runs, comparisons, and workflow replays. Legacy unsupported-claim inference remains supported.

Focused contract, producer, and repository tests passed `19/19`, including cross-project/source-run rejection, missing evidence traces, invalid category rejection, duplicate/idempotent persistence, and regression refusal for grounding, citations, graph accuracy, latency, queue delay, tokens, and cost. `npm run typecheck` passed.

`npm run quality:slice4:replay` locally persisted and read back `24` runs, `12` proposals, `12` comparisons, and `12` workflow replays from PostgreSQL. The generated [slice-4-replay-report.json](../../benchmarks/slice-4-replay-report.json) contains the source run plus all fixture artifacts and before/after deltas; all eleven new workflows improved without regressions. This is local deterministic evidence, not provider, browser, live connector, or production verification.

Slice 4 local replay requirements are now implemented/tested/locally verified. Remaining release-governance gaps are provider or human-reviewed quality measurement, authenticated operator approval UI, live connector evidence, and production verification. The next implementation slice can be Slice 5; do not claim Slice 4 production readiness from this local evidence.

## 2026-10-10 Slice 5 developer API and operator workspace checkpoint

The first Slice 5 vertical boundary is now implemented in the preserved dirty worktree. The typed SDK exposes `retain → recall → trace → correct → replay → evaluate`; the new developer routes enforce authentication and scope, persist evaluations/replays through the canonical repository, and correction emits a revision plus durable event/outbox record. The separate `/sandbox/operator` workspace provides keyboard-visible navigation across health, evidence, graph, conflicts, policies, events, benchmarks, and exports and states its operational modes explicitly.

Direct evidence:

- Focused developer API/correction tests: `7/7` passed.
- TypeScript typecheck: passed.
- Focused Playwright/axe test: `2/2` projects passed against the checkout-local server at widths `375`, `768`, and `1440`, with reduced motion enabled and no serious/critical violations.

Remaining Slice 5 work is authenticated data wiring for operator subsections, complete empty/queued/healthy/degraded/unavailable/failed/unauthorized coverage for every major route, and full PostgreSQL/browser workflow evidence. This is not a Slice 5 completion or production-readiness claim.

For the complete cross-slice audit and the next execution order, continue with [the Tier-1 Slices 1–5 audit and completion handoff](./2026-10-10-tier1-slices-1-5-audit-next-chat.md).

## 2026-10-10 execution update: local database and browser gates

Local Docker/PostgreSQL staging is available and migrations through `0012_fact_project_scope.sql` were applied. `quality:audit:postgres` passed with 111/111 provenance and mutation-ledger coverage across 111 records and 797 events. Staging validation, deterministic Slice 4 report/replay, and the full 18-test Chromium/mobile browser suite passed.

The browser run exposed a review-event sequence collision under parallel traffic. It is fixed by allocating review event sequences inside a repository transaction using a project-scoped PostgreSQL advisory lock; focused tests passed and the full browser suite passed after the rebuild.

The next local boundary is a real authenticated `retain → recall → trace → correct → replay → evaluate` API/SDK diagnosis sequence plus seven-state route coverage. The only required user intervention for Slice 3 is explicit authorization for an external provider measurement and subsequent human review; do not read, paste, or expose credentials. There is no provider adapter in this checkout, so authorize the adapter and an explicit budget/corpus before invoking any provider.

## 2026-10-10 Slice 3 authorized Gemini result

The user authorized Gemini with a `$1` cap and Codex reviewer. A redacted five-case representative measurement ran through the new proposal-only Gemini adapter. It completed in `16,405ms`, recorded estimated cost `$0.01`, and performed zero canonical writes. All five returned proposals failed strict schema validation and were rejected; no human approval was possible or performed. The safe next action is to tighten structured response generation and rerun a valid sample before measuring quality across the full corpus. Do not claim provider quality from this rejection-only run.

## 2026-10-10 Slice 5 continuation checkpoint

Current worktree changes add typed operational state envelopes, project-scoped correction requests, authenticated retain/recall route entry, and safe operator subsection rendering without fabricated staging query parameters. New focused state/handler/operator tests passed. Rebuilt local staging passed all five validation checks and the full Playwright suite passed `18/18` across Chromium and mobile. Full Vitest passed `237` with `6` skipped; typecheck and `git diff --check` passed (existing CRLF warnings only).

Do not mark the Slice 5 diagnosis complete yet: direct PostgreSQL workflow execution needs a non-secret in-agent connection mechanism, and a browser session identity bridge is still needed before subsections can display authenticated route data. Slice 3 provider review/quality and all connector authorization remain separate governed gates.

## 2026-10-10 authenticated diagnosis browser evidence

The missing local diagnosis proof now exists as `tests/e2e/developer-diagnosis.spec.ts`. It passed in Chromium and mobile through authenticated retain, recall, trace, project-scoped correction, replay, evaluation, and protected durable evaluation/replay readback against rebuilt local PostgreSQL staging. The full Playwright suite passed `20/20`; full Vitest passed `239` with `6` skipped; typecheck and diff validation passed. The direct database-unit harness remains environment-gated, but the route workflow is now locally and browser verified through the canonical staging service.

## 2026-10-10 Slice 4 operator approval evidence and local audit

The authenticated operator review action is browser verified on Chromium and mobile. It records the review event against durable evidence, and reviewer identity is now server-derived from the authenticated principal. The deterministic Slice 4 report and replay scripts completed against local PostgreSQL: 512 cases were read back; 24 evaluation runs, 12 correction proposals, 12 comparisons, and 12 workflow replays were read back; all eleven governed replay categories improved without regression.

Current direct validation: full Vitest `72` files / `240` tests passed with `6` skipped; typecheck passed; PostgreSQL provenance/event-ledger audit scanned 124 records and 1,065 events with complete coverage; staging validation passed all five checks; full serial Playwright passed `20/20`. One prior six-worker Playwright run suffered a transient mobile post-mutation event-read connection reset, so parallel-load resilience remains unproven despite the isolated and serial browser passes.

Next governed boundary: repair the Gemini structured proposal contract so a valid, redacted proposal sample can be measured and human-reviewed. Do not rerun a paid provider call or authorize any connector without a renewed explicit budget/authorization decision.

## 2026-10-10 Gemini proposal-contract repair

The local Gemini adapter now rejects unknown source-event references and binds immutable scope, timestamp, Gemini source metadata, and evidence ID from the supplied event before schema validation. Focused provider/extraction tests passed `10/10` and typecheck passed. No second provider call was made. The next action requires a renewed explicit spend authorization, followed by a valid redacted proposal sample and Codex human review; connector authorization remains separate.

## 2026-10-10 final local Slice 1–5 evidence

All locally implementable Slice 1–5 requirements are complete. Direct PostgreSQL diagnosis passed; the corrected 200/200/200 retain-recall-worker SLO workload had zero failures, zero dead letters, retain p95 `34.33ms`, recall p95 `59.42ms`, and full worker completion within 60 seconds. Authenticated operator subsections now load protected durable data without fabricated scope, and proposal-only review routing covers allow, deny, redact, require-review, and defer with rejected proposals reporting zero canonical writes.

Final evidence: Vitest `74` files / `247` tests passed with `6` skipped; typecheck passed; serial authenticated Chromium/mobile Playwright passed `24/24`; staging validation passed all five checks; PostgreSQL audit scanned 124 records and 1,076 events at 100% provenance and mutation-ledger coverage; diff check passed with existing CRLF warnings only.

Remaining only external/governed holds: renewed Gemini spend authorization plus a valid redacted sample for human-reviewed quality measurement, and separately authorized connector/live/production evidence. No connector authorization was performed.
