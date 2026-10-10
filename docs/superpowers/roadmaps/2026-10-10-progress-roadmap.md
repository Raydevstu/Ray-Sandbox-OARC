# Tier-1 Memory Platform Progress Roadmap

Date: 2026-10-10
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`
Branch: `renewal-roadmaps`

## Current state

The local implementation has a durable PostgreSQL-backed runtime, scoped authentication contracts, Codex lifecycle ingestion, retention/deletion behavior, benchmark persistence, review/audit surfaces, monitoring/dead-letter primitives, connector contracts, and a Playwright/axe test harness. Docker staging/production-like validation and local backup-manifest verification are present.

Status meanings remain strict: `IMPLEMENTED` is source code, `TESTED` is automated evidence, and `VERIFIED` requires the corresponding live/browser/production evidence.

## Technical target audit

| Target | Status | Evidence and remaining gap |
|---|---|---|
| Recall API p95 <500ms excluding model time | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | 200-request staging workload measured p50/p95/p99 `43.41/67.05/77.00ms` |
| Retain acknowledgment p95 <250ms | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | 200-request sustained staging workload measured p50/p95/p99 `32.49/44.41/48.06ms`; writes were serialized because concurrent retain exposed pre-existing non-atomic repository writes |
| Worker completion 99% within 60s | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | 200 durable Codex-event jobs completed `200/200` within 60s; completion rate `100%`, dead letters `0` |
| Zero cross-tenant results | `TESTED LOCALLY` | Scoped repository and migration isolation tests pass; a larger automated isolation corpus is pending |
| 100% derived memories linked to evidence | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | `npm run quality:audit:postgres` found `88/88` durable records linked to evidence (`100%`) |
| 100% mutations represented in event ledger | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | Live audit correlated direct memory events or durable source conversation events/evidence references and found `88/88` represented (`100%`) |
| Dead-letter recovery through replay | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | PostgreSQL integration test forces dead-letter, replays after a worker restart, claims the job, and verifies durable `complete` state |

| Workstream | Status | Remaining proof or work |
|---|---|---|
| Codex capture and durable ingestion | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | Real desktop multi-turn session is verified at session level: user/assistant turns, read-only tool result, failed command, cancellation UI, successful retry, duplicate-safe processing, and Memory Trace lineage. Exact raw cancellation lifecycle event remains only partially exposed by the aggregate trace UI |
| Authenticated browser QA | `IMPLEMENTED / TESTED / BROWSER VERIFIED / PARTIAL` | `npm run test:e2e` passed `12` with `2` skipped across Chromium/mobile; authenticated audit/events/manifest/trace APIs and operator UI passed at 768px with no serious/critical axe violations. Review mutation remains skipped when staging has no reviewable record; no separate export endpoint exists |
| Retention/deletion | `IMPLEMENTED / TESTED` | Production policy approval, scheduled enforcement, and deletion evidence |
| Backup/restore | `IMPLEMENTED / TESTED LOCALLY` | Local temporary-database restore drill passed; restore against the deployed target and measured RPO/RTO remain |
| Monitoring/dead letters | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | Local PostgreSQL retry→dead-letter drill passed; operations status now separates active degradation from historical errors. Live alert delivery and worker restart evidence remain |
| Production-like local deployment | `IMPLEMENTED / TESTED / LOCALLY VERIFIED` | Port `3029` container passed health, readiness, PostgreSQL, auth-enforcement, static-asset, and latency gates; external provider deployment and rollback remain pending |
| Non-local deployment | `NOT VERIFIED` | Deploy to the chosen provider and run health, auth, database, and rollback checks |
| Memory quality | `IMPLEMENTED / TESTED LOCALLY` | Deterministic 512-case corpus report passes local precision, multi-hop, isolation, and reproducibility gates; matched live Codex A/B corpus and human review outcomes remain pending |
| UX and onboarding | `IMPLEMENTED / TESTED LOCALLY` | Four-step onboarding and user-facing Memory health summary are implemented and browser/axe verified; full guided action state and operator/user separation remain |
| Connector expansion | `CONTRACTS / PARTIAL` | Independent live evidence for Hermes, OpenAI API storage-only ingestion, OpenCode, and VS Code |

## Active execution authority

The canonical execution blueprint is now [2026-10-10 Apex Evidence-Driven Control Plane Blueprint](../blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md). The earlier competitive-upgrade blueprint remains historical evidence and architecture context.

## Ordered next slice — Slice 1: Enterprise Evidence Integrity Baseline

1. Run a meaningful sustained SLO workload and preserve retain/recall p50, p95, p99, worker completion, queue delay, and failure measurements.
2. Make the PostgreSQL derived-memory-to-evidence audit exhaustive for the active scope.
3. Make the mutation-to-event-ledger audit exhaustive for the active scope.
4. Prove dead-letter replay reaches durable completion after restart/recovery.
5. Finish missing authenticated review/events/manifest/export journeys and 768px accessibility evidence.
6. Update this roadmap with exact measurements, evidence labels, and remaining gaps.

The following are deliberately frozen until separately authorized: non-local deployment, provider credentials, external rollback/RPO/RTO proof, and live non-Codex connector authorization. Local port `3029` validation remains production-like local evidence only.

## 2026-10-10 Slice 5 developer API and operator workspace checkpoint

The first Slice 5 vertical boundary is implemented locally:

- `lib/runtime/sdk/client.ts` now exposes the complete developer workflow methods `retain`, `recall`, `trace`, `correct`, `replay`, and `evaluate` over stable API paths.
- `/api/v1/memory/trace`, `/api/v1/memory/[id]` `PATCH`, `/api/v1/memory/replay`, and `/api/v1/memory/evaluate` enforce authentication, tenant/bank scope, validation, explicit unavailable-store responses, and repository-backed persistence.
- Corrections now create a new revision plus a durable `MemoryCorrected` event and outbox record with an idempotency boundary.
- `/sandbox/operator` is a distinct operator workspace entry point with keyboard-visible navigation for health, evidence, graph, conflicts, policies, events, benchmarks, and exports, plus explicit operational states.
- Focused developer API and correction tests passed `7/7`; typecheck passed.
- Focused Playwright/axe coverage passed `2/2` projects at 375, 768, and 1440 widths with reduced-motion enabled and no serious/critical violations.

This checkpoint is `IMPLEMENTED / TESTED`; the focused operator journey is locally browser-verified against a checkout-local Next server. Slice 5 remains open: the operator subsections still need authenticated data wiring, all major-route state coverage, full developer workflow integration tests against local PostgreSQL, and a complete browser journey for the finished workspace. No provider, live connector, external deployment, or production evidence is claimed.

## Non-goals for this checkpoint

- No claim of external production deployment.
- No claim that a connector is live because only its shared contract exists.
- No destructive cleanup or branch consolidation; the dirty worktree remains user-owned.

## 2026-10-10 Slice 1 validation evidence

- Focused runtime suite: `npm test -- tests/runtime/capture-status.test.ts tests/runtime/codex-capture.test.ts tests/runtime/codex-event-route.test.ts tests/runtime/audit-read.test.ts tests/runtime/memory-audit.test.ts tests/runtime/memory-review.test.ts tests/runtime/project-worker.test.ts tests/runtime/telemetry.test.ts tests/runtime/benchmark-route.test.ts` — `9` files and `29` tests passed.
- TypeScript: `npm run typecheck` — passed.
- Local staging: `docker compose -f docker-compose.staging.yml up -d --build` — app image built, PostgreSQL healthy, app published on `http://127.0.0.1:3028`.
- Staging/API: `npm run staging:validate` — health, meaningful worker event, import lifecycle, worker completion, and canonical provenance passed.
- Browser: `npm run test:e2e` — `6` passed across Chromium and mobile projects. Serious/critical axe violations were empty; authenticated audit API access, keyboard focus, and 375/1440 layout checks passed. The current suite does not cover 768px or the full review/events/manifest/export journey.
- Host-hook boundary: two supplied `UserPromptSubmit`/`Stop` payloads exited `0` and the events API reported `4` events (`2` `ConversationImported`, `2` `ProjectMemoryRecorded`). This is synthetic host-hook evidence, not automatic capture of the surrounding desktop Codex task; no real multi-turn desktop adapter/export was available.
- Restore: `npm run db:verify-backup:postgres -- artifacts/production-predeploy.dump` passed manifest checks. A temporary PostgreSQL database restore also passed with the expected three tables and `110` restored project events / `77` jobs, then the exact temporary database was removed. The first combined probe had a PowerShell null-check warning, so cleanup was independently verified.
- Dead-letter/monitoring: an exact temporary job was claimed twice (`attempts 1` then `2`), transitioned `pending` after the first failure and `dead-letter` after the second, and `/api/project-memory/operations` returned `status: degraded` with `deadLetter: 1`; the drill rows were then removed and the endpoint returned `status: ok` with `deadLetter: 0`.
- Residual operational diagnostic: the post-drill endpoint still reports a historical `lastError` from older completed jobs (`duplicate key value violates unique constraint ...`). It does not currently change `status: ok` or `deadLetter: 0`, but the monitoring surface should distinguish historical retry errors from active failures before production use.
- Real desktop capture: Memory Trace queries `user_cancelled` and `command_not_found` returned durable records sharing conversation lineage `01a122a8-1777-74f1-9009-dd1fa12609a9`; screenshots show the stopped operation, successful retry, and successful `git status` result. This is local/session-level evidence, not production evidence.
- Operational gates: `tests/runtime/deployment-gates.test.ts` passed `3/3`; `npm test` passed `155` tests with `4` skipped; `npm run typecheck` passed. The production-like image is now running locally on `http://127.0.0.1:3029`; `npm run deployment:validate` passed health, PostgreSQL readiness, authentication enforcement, static assets, and the 500ms latency ceiling.
- Technical target audit: focused runtime coverage passed `21` tests with `4` skipped across quality/evidence, retention, repository isolation, worker, PostgreSQL integration, migration, and contract suites. This verifies the contracts and local paths; it does not substitute for p95, 99%-within-60s, exhaustive completeness, or production-scale measurements.
- PostgreSQL quality audit: `npm run quality:audit:postgres` scanned `66` project-memory records and `211` project events. Provenance coverage was `100%`; mutation-to-ledger coverage is now `100%` by correlating direct memory events or durable source conversation events/evidence references.
- SLO workload: `$env:SLO_ITERATIONS='200'; $env:SLO_CONCURRENCY='8'; npm run quality:slo:workload` ran 200 retain, 200 recall, and 200 durable Codex-event workload requests against `http://127.0.0.1:3028`. Retain p50/p95/p99 were `32.49/44.41/48.06ms`; recall p50/p95/p99 were `43.41/67.05/77.00ms`; queue-delay p50/p95/p99 were `0/0/0ms`; failures were `0`; worker completion was `200/200` within 60 seconds with `0` dead letters. Exact queue delay is measured from the additive `jobs.claimed_at` timestamp.
- The same harness previously exercised concurrent retain writes and exposed pre-existing non-atomic PostgreSQL repository writes (`outbox`/`fact_evidence` foreign-key failures). Slice 1 evidence therefore uses serialized retain writes and keeps concurrent recall plus serialized sequence-sensitive Codex events; atomic retain transaction hardening remains an explicit follow-on risk.
- PostgreSQL migration: `npm run db:migrate:postgres` applied the additive `jobs.claimed_at` column in migration `0005_project_worker.sql`.
- Adversarial corpus: `npm run quality:adversarial:report` ran all `512` deterministic cases. Precision `1.0`, multi-hop accuracy `1.0`, isolation failures `0`, all five categories passed, and reproducibility was `true`. Evidence is deterministic local retrieval replay, not a live provider/model quality claim.
- Operator browser journey: `tests/e2e/operator-journey.spec.ts` passed in Chromium and mobile with authenticated API checks for audit, events, manifest, and trace plus serious/critical axe checks. `tests/e2e/operator-review.spec.ts` was exercised but skipped because staging contained no conflict/uncertain/stale record safe for mutation.
- Responsive operator QA: the authenticated audit/trace journey passed at the dedicated `768x900` viewport in Chromium and mobile projects with no serious/critical axe violations.
- Broad validation: `npm test` passed `175` tests with `5` skipped; `npm run typecheck` passed; `npm run test:e2e` passed `12` with `2` skipped. Focused Slice 1 runtime tests passed `18/18`.

The one recommended next action is Slice 2 — Typed Temporal Evidence Graph. Before production use, separately harden retain persistence into an atomic transaction and add a seeded reviewable browser fixture or authorized live review record; external deployment remains a separate explicitly authorized gate.

## 2026-10-10 Slice 2 implementation evidence

- `IMPLEMENTED / TESTED`: typed graph contracts now include entity aliases, typed temporal edges, evidence IDs, deterministic alias resolution, reviewable active conflicts, and bounded cycle-safe traversal.
- `IMPLEMENTED / TESTED`: `retrieveTypedGraph` applies an as-of timestamp and returns complete two-hop explanation paths with every selected edge's evidence IDs and temporal metadata.
- `IMPLEMENTED / TESTED`: PostgreSQL migration `0009_typed_graph.sql` adds scoped aliases and conflict records, temporal edge columns, evidence JSON, indexes, and repository/test-double persistence with fail-closed scope checks.
- `LOCALLY VERIFIED`: `npm run db:migrate:postgres` applied `0009_typed_graph.sql` to the local staging database; focused graph, repository, and migration tests passed `13/13`; the full-suite verification is recorded below.
- Slice 2 limits: no browser graph journey, live connector evidence, external deployment, or production verification was added; Slice 3 provider extraction remains untouched.

## 2026-10-10 Slice 2 and Slice 3 completion checkpoint

- Slice 2 `IMPLEMENTED / TESTED / LOCALLY VERIFIED`: graph aliases, deterministic resolution, temporal two-hop retrieval, explanation paths, reviewable conflicts, scoped authenticated graph API, and database-enforced edge-to-evidence links are present. Migration `0009_typed_graph.sql` was applied locally; graph, repository, route, and migration tests passed `13/13` in the focused run.
- Slice 2 regression coverage now includes as-of temporal filtering, expired/superseded history, ambiguous aliases, contradictory active edges, cycle protection, complete explanation paths, invalid time ranges, missing evidence, authentication, and malformed query handling.
- Slice 2 remains `PARTIAL` for release governance: no dedicated browser graph journey or live connector/production evidence was added.
- Slice 3 `IMPLEMENTED / TESTED`: provider-neutral extraction now enforces strict record schemas, candidate/count and cost budgets, timeout handling, deterministic degraded fallback, confidence/policy review routing, and redacted provider telemetry. Focused extraction/governance tests passed `14/14`.
- Slice 3 remains `PARTIAL` for its evidence gate: no authorized external provider credentials or human-reviewed quality sample was available, so provider precision/cost/latency against the adversarial corpus and human-reviewed cases is not claimed.
- Final verification: `npm test` passed `186` tests with `5` skipped; `npm run typecheck` passed; rebuilt local staging with `docker compose -f docker-compose.staging.yml up -d --build`; `npm run test:e2e` passed `12` with `2` skipped, including the authenticated graph API in the 768px operator journey; `git diff --check` passed with existing line-ending warnings only.

## 2026-10-10 Slice 4 implementation checkpoint

- Slice 4 `IMPLEMENTED / TESTED`: `lib/runtime/evaluation-contract.ts` adds versioned corpus/config identity, hash validation, trace-linked per-case results, grounded accuracy, citation precision, unsupported-claim rate, graph accuracy, p50/p95 latency, tokens, queue delay, cost, failure classification, and before/after replay comparison with explicit deltas and regression refusal.
- Slice 4 `IMPLEMENTED / TESTED`: migration `0010_evaluation_replay.sql` and repository adapters persist scoped evaluation runs and replay comparisons as durable PostgreSQL JSONB records. Test-double persistence verifies idempotent replacement and fail-closed tenant scope.
- Focused Slice 4 tests passed `10/10` across contract, repository, and migration suites; `npm run typecheck` passed.
- Slice 4 remains `PARTIAL` for its benchmark evidence gate: no new 500+ corpus expansion beyond the existing deterministic 512-case corpus, no provider-backed or human-reviewed quality sample, no benchmark report generated from this new durable schema, and no browser/live connector/production evidence.
- External deployment, provider credentials, rollback/RPO/RTO proof, and live non-Codex connector authorization remain frozen.

The recommended next action is to populate and persist a versioned 500+ Slice 4 evaluation manifest/results report using the new contract, then add the correction-proposal and workflow-replay path against durable evidence.

## 2026-10-10 Slice 4 corpus evaluation report

- `IMPLEMENTED / TESTED`: `lib/runtime/evaluation-producer.ts` produces deterministic `slice-4-adversarial-v1` coverage with `512` cases across temporal, graph, conflict, scope, deletion, and correction classes.
- `BENCHMARK VERIFIED` for this deterministic local workload: `npm run quality:slice4:report` produced [slice-4-evaluation-report.json](../../benchmarks/slice-4-evaluation-report.json), persisted run `slice-4-f5d13678154eff47`, and read it back from PostgreSQL.
- Absolute results: grounded accuracy `1.000`, citation precision `1.000`, unsupported-claim rate `0.000`, graph accuracy `1.000`, p50/p95 latency `18/26ms`, total tokens `20,986`, average queue delay `1.994ms`, cost `$0.00`, cost per correct answer `$0.00`, correct cases `512/512`.
- Reproducibility: rerunning with the same fixed timestamp produced the identical report SHA-256 `60E10A570C7E0F0FBC7DDF8A434E3C6244D0165B182330DD303A46260A1BD5EC`; PostgreSQL readback confirmed `512` cases and grounded accuracy `1`.
- Evidence limit: this is a deterministic local corpus/judge report, not provider quality, human-reviewed quality, live connector, browser, or production evidence. Correction proposals and workflow replay remain pending.

The recommended next action is to implement durable failure classification, correction proposals, and workflow replay against this persisted run, then generate before/after deltas without claiming provider quality.

## 2026-10-10 Slice 4 correction and replay result

- `IMPLEMENTED / TESTED`: failed evaluation cases now produce durable correction proposals preserving the source run, case ID, failure categories, and evidence trace IDs.
- `IMPLEMENTED / TESTED`: workflow replay records bind the original run, replay run, correction proposal, evidence traces, and complete before/after comparison deltas. Any quality, grounding, latency, queue, token, or cost regression blocks `improved`.
- `IMPLEMENTED / LOCALLY VERIFIED`: migration `0011_evaluation_corrections.sql` adds scoped correction and workflow replay tables with run/proposal foreign keys. `npm run quality:slice4:replay` persisted one proposal and one improved replay; PostgreSQL readback confirmed `corrections=1`, `replays=1`, `improved=1`.
- Replay fixture delta: grounded accuracy `+0.001953125`, unsupported-claim rate `-0.001953125`; citation, graph, latency, queue, token, and cost deltas were `0`.
- Evidence limit: the replay is deterministic local evidence over the versioned corpus, not provider, human-reviewed, browser, live connector, or production evidence.

The recommended next action is to connect correction proposals to an authenticated operator approval workflow and add replay cases for temporal, scope, deletion, and graph failures.

## 2026-10-10 Slice 4 replay safety and coverage completion

- `IMPLEMENTED / TESTED`: evaluation cases now accept validated explicit failure categories. Durable correction proposals classify stale facts, wrong scope, temporal interpretation, entity resolution, contradictions, missing evidence, policy rejection, and connector delivery failures; legacy unsupported-claim and missing-graph-hop inference remains supported.
- `IMPLEMENTED / TESTED`: `buildSliceFourReplayFixtures` creates deterministic baseline/replay/proposal/workflow fixtures for all eleven governed categories: stale fact, wrong scope, temporal interpretation, entity resolution, contradiction, missing evidence, policy rejection, connector delivery, deletion, correction, and missing graph hop.
- `TESTED`: focused Slice 4 contract, producer, and repository tests passed `19/19`. Coverage includes missing traces, source-run/project mismatch, invalid categories, duplicate/idempotent writes, and regressions in grounding, citations, graph accuracy, latency, queue delay, tokens, and cost.
- `LOCALLY VERIFIED`: `npm run quality:slice4:replay` persisted and read back `24` runs, `12` correction proposals, `12` replay comparisons, and `12` workflow replays in local PostgreSQL (eleven new fixtures plus the prior fixture). Every fixture retained its source trace through the baseline, proposal, and workflow replay; all eleven comparisons were improved with no regressions.
- Durable report: [slice-4-replay-report.json](../../benchmarks/slice-4-replay-report.json) records the source run and every baseline, replay, proposal, workflow, trace link, metric set, and before/after delta. This is reproducible local evidence only.
- `npm run typecheck` passed. External provider/human-reviewed quality, authenticated operator approval/browser workflow, live connector, and production evidence remain release-governance gaps and are not claimed here.
