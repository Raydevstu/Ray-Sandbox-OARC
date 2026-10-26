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
| Codex capture and durable ingestion | `IMPLEMENTED / TESTED / LOCALLY VERIFIED / LIVE CONNECTOR VERIFIED` | A controlled local Codex session persisted the exact user prompt and assistant acknowledgement to PostgreSQL with project scope and `codex-hook` provenance. Windows path-separator normalization prevents duplicate project identities. Exact raw cancellation lifecycle event remains only partially exposed by the aggregate trace UI; external production remains unverified. |
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

## 2026-10-23 Phase 0 runtime truth checkpoint

`IMPLEMENTED / TESTED`: `/api/runtime-truth` now exposes a no-store, non-secret runtime identity contract containing environment, authentication mode, canonical-store status, build identifier, and evidence boundary. The sandbox footer consumes this contract and no longer claims only `Local UI ready` without identifying runtime truth. Dashboard queue charts now omit unmeasured series instead of coercing unavailable state to zero, and the operations badge follows the actual `live`, `stale`, or `disconnected` state.

Focused runtime tests and typecheck pass. `LOCALLY VERIFIED` browser evidence is pending against the intended current runtime; the existing `3028` process is an older instance and the documented `3030` development process was not running during this checkpoint. Production evidence remains unclaimed.

## Ordered next slice — Slice 1: Enterprise Evidence Integrity Baseline

1. Run a meaningful sustained SLO workload and preserve retain/recall p50, p95, p99, worker completion, queue delay, and failure measurements.
2. Make the PostgreSQL derived-memory-to-evidence audit exhaustive for the active scope.
3. Make the mutation-to-event-ledger audit exhaustive for the active scope.
4. Prove dead-letter replay reaches durable completion after restart/recovery.
5. Finish missing authenticated review/events/manifest/export journeys and 768px accessibility evidence.
6. Update this roadmap with exact measurements, evidence labels, and remaining gaps.

The following are deliberately frozen until separately authorized: non-local deployment, provider credentials, external rollback/RPO/RTO proof, and live non-Codex connector authorization. Local port `3029` validation remains production-like local evidence only.

## 2026-10-10 Tier-1 audit of Slices 1–5

The direct audit at checkpoint `0d24489` confirms the following evidence position:

| Slice | Status | Pending local work | Held evidence |
|---|---|---|---|
| 1 — Enterprise Evidence Integrity Baseline | `PENDING — CAN COMPLETE LOCALLY` | Atomic concurrent retain transaction; broader isolation corpus; reviewable browser seed; export route and authorization; rerun staging/browser gates. | Deployed-target restore/RPO/RTO, external deployment, and production retention evidence. |
| 2 — Typed Temporal Evidence Graph | `IMPLEMENTED / TESTED / LOCALLY VERIFIED; BROWSER PENDING` | Dedicated authenticated browser journey for as-of, before-upgrade, supersession, contradictions, aliases, and two-hop explanation paths. | None required for local completion; no paid dependency. |
| 3 — Provider Extraction and Human Approval | `IMPLEMENTED / TESTED; MANUAL/PROVIDER PENDING` | Local deterministic approval-queue fixtures and browser proof that invalid/rejected proposals cannot persist. | Authorized provider run and human-reviewed quality sample; online/paid access may be required. |
| 4 — Closed-Loop Evaluation and Replay | `COMPLETE FOR LOCAL DETERMINISTIC SCOPE` | Optional local operator approval/replay readback UI and browser evidence; these are governance evidence additions, not replay-core blockers. | Provider/human quality, live connector, and production evidence. |
| 5 — Developer API and Operator Experience | `PENDING — CAN COMPLETE LOCALLY` | Project-scoped trace filtering; full PostgreSQL SDK workflow; durable operator subsection wiring; seven operational states; authenticated diagnosis journey. | None required for local completion; no paid dependency. |

Current direct checks: `npm test` passed 65 files / 212 tests with 1 file / 5 tests skipped; `npm run typecheck` passed; `git diff --check` passed with existing line-ending warnings. The skipped tests and all held evidence remain explicit and are not inferred as failures or completions.

The authoritative implementation plan is [Tier-1 Slices 1–5 Local Audit and Completion Plan](../plans/2026-10-10-tier1-slices-1-5-audit-completion.md). The next chat should execute Tasks 1, 5, 6, 2, and 4 in that order, prepare Task 3 locally, then pause for provider authorization before claiming provider-quality evidence.

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

## 2026-10-10 ordered completion pass

- `IMPLEMENTED / TESTED`: durable retention now writes evidence, fact, fact-evidence links, event ledger, and outbox through one repository transaction. Runtime PostgreSQL transactions use a pinned client rather than interleaved pool statements.
- `IMPLEMENTED / TESTED`: classic facts accept optional `projectId`; retain, recall, lexical retrieval, PostgreSQL reads/writes, and the developer trace route now enforce project filtering when supplied. Migration `0012_fact_project_scope.sql` adds the nullable column and index.
- `IMPLEMENTED / TESTED`: `/api/project-memory/export` provides authenticated JSON and Markdown manifest downloads with explicit scope, unavailable-store, and validation responses.
- `IMPLEMENTED / TESTED`: authenticated conflicts and evaluation evidence routes are available at `/api/project-memory/conflicts` and `/api/project-memory/evaluations`; operator subsections now link to durable routes instead of displaying a placeholder-only state.
- `BROWSER VERIFIED`: the dedicated temporal graph journey passed Chromium and mobile; the operator workspace passed Chromium and mobile at 375, 768, and 1440 widths with reduced-motion, focus, and serious/critical axe checks. The first run against port 3028 returned a stale-app 404 and was not counted; the rerun used this checkout on port 3040.
- Fresh unit evidence: `npm test` passed `68` files, `218` tests, with `5` skipped; `npm run typecheck` passed. Provider authorization and human-reviewed quality remain held because the repository has no provider adapter or authorized measurement workflow, and no credentials were read or exposed.
- `LOCALLY VERIFIED`: `npm run staging:validate` passed health, meaningful worker event, import capture lifecycle, worker completion, and canonical provenance. A 100-request concurrent SLO run passed with zero failures, `retain p95 48.94ms`, `recall p95 148.5ms`, and `100/100` worker completion; its configured base URL was the existing `3028` service and is not used as browser identity evidence.
- PostgreSQL audit rerun was unavailable because `APEX_DATABASE_URL` was not configured in this shell; no audit claim was upgraded from that command.

## 2026-10-10 local PostgreSQL and browser evidence update

- `LOCALLY VERIFIED`: rebuilt Docker staging applied migrations through `0012_fact_project_scope.sql`. `npm run quality:audit:postgres` scanned `111` records and `797` events with provenance and mutation-ledger coverage `111/111` (100%). `npm run staging:validate` passed all five health, worker, capture, completion, and provenance checks.
- `BENCHMARK VERIFIED` for deterministic local replay only: `npm run quality:slice4:report` persisted `512` cases with grounded accuracy, citation precision, and graph accuracy `1.0`, unsupported-claim rate `0`, and p50/p95 `18/26ms`. `npm run quality:slice4:replay` persisted `24` runs, `12` proposals, `12` comparisons, and `12` workflows; all comparisons improved without regressions.
- `BROWSER VERIFIED`: the full `npm run test:e2e` suite passed `18/18` on Chromium and mobile against rebuilt local staging. It includes an authenticated review mutation, temporal graph, trace, audit/events/export, responsive operator workspace, keyboard/focus/reduced-motion behavior, and serious/critical axe checks.
- `IMPLEMENTED / TESTED`: review events now allocate their project sequence transactionally under a PostgreSQL advisory transaction lock. This fixes the concurrent duplicate-sequence failure first exposed by the mobile review browser run; focused repository/review tests passed `11/11`.
- Fresh regression evidence: `npm test` passed `219` tests with `5` skipped; `npm run typecheck` passed; `git diff --check` passed with existing CRLF conversion warnings only.
- Remaining gates: Slice 3 has no concrete external provider adapter or authorized provider run, and no human-reviewed measurement. Slice 4 lacks a browser workflow that approves correction proposals and launches replay from the operator UI; its current browser evidence covers evidence-linked memory review mutation. Slice 5 still needs a true end-to-end authenticated SDK/API diagnosis sequence and per-route proof of all seven states. These are not production claims.

## 2026-10-10 Slice 5 state-envelope continuation

- `IMPLEMENTED / TESTED`: developer retain and recall now authenticate before repository construction. Successful retain returns `healthy`; successful recall returns `healthy` or `empty` from the scoped result count. Correction requires `projectId`, so same-bank corrections cannot select another project's fact.
- `IMPLEMENTED / TESTED`: correction, trace, replay, and evaluation now emit an explicit state on successful and failed responses. The shared operational-state contract defines `empty`, `queued`, `healthy`, `degraded`, `unavailable`, `failed`, and `unauthorized`.
- `IMPLEMENTED / TESTED`: operator section pages no longer construct a `staging-*` tenant/bank/project URL. They fail closed with a typed `unauthorized` state until a browser identity bridge supplies authenticated project scope.
- `LOCALLY VERIFIED / BROWSER VERIFIED`: rebuilt local staging passed `npm run staging:validate` (five checks) and the complete `npm run test:e2e` suite (`18/18` Chromium/mobile). `npm test` passed `237` tests with `6` skipped; typecheck passed; `git diff --check` passed with existing CRLF warnings.
- Remaining: direct PostgreSQL diagnosis-test execution still requires a non-secret test-runtime connection mechanism; the browser has no session identity bridge for operator subsection data. Provider and connector authorization remain separate and unchanged.

## 2026-10-10 authenticated diagnosis workflow evidence

- `LOCALLY VERIFIED / BROWSER VERIFIED`: `tests/e2e/developer-diagnosis.spec.ts` passed on Chromium and mobile against rebuilt Docker staging. It exercised authenticated `retain → recall → trace → correct → replay → evaluate`, then read durable evaluation and replay artifacts from the protected evaluations route. The journey used the canonical PostgreSQL-backed app service without exposing a connection string.
- Current regression evidence: full Playwright suite passed `20/20`; full Vitest passed `239` with `6` skipped; typecheck passed; `git diff --check` passed with existing CRLF warnings.

## 2026-10-10 Slice 4 operator evidence and final local audit update

- `LOCALLY VERIFIED`: `npm run quality:slice4:report` persisted and read back the deterministic 512-case evaluation run from local PostgreSQL. `npm run quality:slice4:replay` persisted/read back 24 runs, 12 correction proposals, 12 replay comparisons, and 12 workflow replays; all 11 governed replay categories improved without regression.
- `BROWSER VERIFIED`: the authenticated evidence-linked review mutation passed in Chromium and mobile. The complete serial Playwright suite passed `20/20`, including the developer diagnosis, operator audit/events/manifest/trace, temporal graph, approval mutation, responsive 375/768/1440 layout, keyboard focus, reduced motion, and serious/critical axe checks.
- `IMPLEMENTED / TESTED`: review events now take their reviewer identity from the authenticated principal rather than an untrusted client payload. Shared retain/recall handler failures now return the same explicit operational state contract as successful responses. Full Vitest passed `72` files / `240` tests, with `6` skipped; typecheck passed.
- `LOCALLY VERIFIED`: `npm run quality:audit:postgres` scanned 124 records and 1,065 events with 100% provenance and mutation-ledger coverage. `npm run staging:validate` passed all five checks.
- Reliability note: one 6-worker Playwright run had a transient mobile event-read `ECONNRESET` after a successful review mutation. The isolated mobile and Chromium cases and the full serial `20/20` rerun passed. Parallel-load resilience is therefore not claimed from this browser evidence.
- Remaining governed hold: Slice 3 needs a valid provider proposal sample before human review/quality measurement can proceed. Connector authorization and live connector proof remain untouched.

## 2026-10-10 Slice 3 authorized Gemini measurement

- `IMPLEMENTED / TESTED`: `lib/runtime/providers/gemini.ts` implements a Gemini `generateContent` adapter behind the existing provider-neutral proposal boundary. It redacts emails and token-like strings before transmission, requires JSON-only responses, uses timeouts/candidate/cost gates already enforced by `extractWithProvider`, and has no canonical persistence capability.
- `LIVE CONNECTOR VERIFIED` for the limited authorized measurement: `npm run quality:provider:gemini` invoked Gemini 2.5 Flash over five redacted representative deterministic cases with a configured maximum budget of `$1`. The recorded estimated request cost was `$0.01`, latency was `16,405ms`, and canonical writes were `0`.
- Reviewer result: Gemini returned five proposals but none satisfied the existing strict record contract; all five were rejected. There are no accepted proposals to promote or manually approve. This is correct safety behavior, not provider quality evidence.
- The redacted report is [gemini-provider-measurement.json](../../benchmarks/gemini-provider-measurement.json). Focused Gemini/extraction tests passed `10/10`; typecheck passed. Quality precision, recall, or cost claims remain unavailable until the provider response schema is tightened and a valid, human-reviewable sample succeeds.

## 2026-10-10 Slice 3 proposal-contract repair

- `IMPLEMENTED / TESTED`: Gemini proposals must now reference a supplied immutable source event. The adapter rejects unknown source events and server-binds tenant, bank, project, event time, Gemini source metadata, and the evidence reference before governed schema validation.
- Focused Gemini/provider extraction tests passed `10/10`; typecheck passed. No new provider request was made and no credential was read or exposed.
- Required hold: the previous authorized measurement budget was consumed. A new explicit budget authorization is required before a remeasurement; only a valid redacted proposal sample can proceed to Codex human review and quality metrics.

## 2026-10-10 final local Slice 1–5 completion evidence

- `LOCALLY VERIFIED`: direct PostgreSQL diagnosis integration passed. The corrected sustained workload completed 200 authenticated retains, 200 recalls, and 200 durable worker events with zero failures, zero dead letters, 100% worker completion within 60 seconds, retain p95 `34.33ms`, recall p95 `59.42ms`, and queue-delay p95 `10ms`.
- `IMPLEMENTED / TESTED / BROWSER VERIFIED`: authenticated operator sections now invoke protected durable handlers in-process with the caller's forwarded identity and explicit project scope; anonymous access remains `unauthorized`. The proposal-only safety endpoint deterministically returns `allow`, `deny`, `redact`, `require_review`, or `defer`, and returns `canonicalWrites: 0` for rejected malformed proposals.
- Final regression evidence: Vitest `74` files / `247` tests passed with `6` skipped; TypeScript passed; serial Chromium/mobile Playwright passed `24/24`; `npm run staging:validate` passed all five checks; PostgreSQL audit scanned 124 records and 1,076 events with complete provenance and mutation-ledger coverage; `git diff --check` passed with existing CRLF warnings only.
- External holds remain unchanged: a renewed explicit provider-spend authorization is required before Gemini remeasurement and human review; connector authorization, live connector proof, deployment, and production proof were not attempted.

## 2026-10-23 Tier-1.5 Phase 1/3/5 benchmark slice

- `IMPLEMENTED / TESTED`: `lib/runtime/tier15-benchmark.ts` and `tests/runtime/tier15-benchmark.test.ts` add a deterministic versioned corpus with explicit tenant, bank, project, conversation, and agent scope; positive and negative controls for namespace isolation, temporal lineage, and adversarial policy boundaries; stable corpus/config/replay hashes; latency, queue, citation, unsupported-claim, leakage, rejection, and canonical-write metrics; and explicit evidence labels.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: `npm run quality:tier15:report` generated `docs/benchmarks/tier15-phase-1-3-5-report.json` for seed `local-v1` and fixed timestamp `2026-10-23T00:00:00.000Z`: 6 cases, namespace leakage `0`, temporal lineage accuracy `1`, adversarial rejection `1`, p50/p95/p99 latency `18/27/27ms`, and adversarial canonical writes `0`. This is deterministic local fixture evidence, not live provider, connector, or production evidence.

## 2026-10-23 PostgreSQL concurrency and duplicate/retry workload

- `IMPLEMENTED / TESTED`: `lib/runtime/slo-workload-plan.ts` creates deterministic unique event plans with duplicate retry attempts. `scripts/slo-workload.mjs` now supports concurrent event submission, duplicate acknowledgement measurement, optional JSON report output, and gates for idempotent retries plus durable worker completion. A PostgreSQL unique-sequence collision in concurrent Codex ingestion is handled as an idempotent duplicate; regression coverage is in `tests/runtime/codex-ingestion.test.ts`.
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: rebuilt `docker-compose.staging.yml` on port `3028`; `npm run staging:validate` passed all five checks. Concurrency `20` report: 20 unique events, 4/4 duplicate retries acknowledged, 20/20 worker completion, zero dead letters, retain/recall p95 `33.62/73.39ms`; all gates passed. Report: [tier15-slo-concurrency-20.json](../../benchmarks/tier15-slo-concurrency-20.json).
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: concurrency `100` report: 100 unique events, 10/10 duplicate retries acknowledged, 100/100 worker completion, zero dead letters, retain/recall p95 `33.37/515.59ms`. Duplicate safety and worker completion passed; recall p95 exceeded the `500ms` target, so the workload gate failed and this is a capacity finding. Report: [tier15-slo-concurrency-100.json](../../benchmarks/tier15-slo-concurrency-100.json).

## 2026-10-23 concurrency-100 recall contention investigation

- `IMPLEMENTED / TESTED`: PostgreSQL lexical recall now uses a bounded, scope-filtered candidate query before evidence aggregation (`searchFacts`), while the test-double fallback and ranking contract remain unchanged. Focused repository/retrieval tests passed `14/14`; typecheck passed.
- `LOCALLY VERIFIED`: rebuilt staging with the corrected query; `npm run staging:validate` passed all five checks. The optimized concurrency-100 report recorded 100 unique events, 10/10 duplicate retries acknowledged, 100/100 worker completion, zero dead letters, retain p95 `35.68ms`, and recall p95 `515.61ms`; the recall-under-500ms gate still failed. Report: [tier15-recall-optimized-concurrency-100.json](../../benchmarks/tier15-recall-optimized-concurrency-100.json).
- Investigation result: the bounded candidate query improved recall p50 to `406.77ms` but did not improve p95 versus the `515.59ms` baseline. A reversible local pool-size experiment (20 versus the default 5) worsened recall p95 to `599.28ms` and was removed; no pool-size change remains in the worktree.
- Evidence boundary: this remains local Docker/PostgreSQL benchmark evidence only. Do not expand to higher workloads until query-plan/database profiling identifies the p95 bottleneck and a follow-up change clears the concurrency-100 recall target.

## 2026-10-23 PostgreSQL recall query-plan profiling

- `IMPLEMENTED`: `scripts/postgres-recall-profile.mjs` adds a read-only profiling harness for the existing staging path. It captures the exact recall `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)` plan, sampled `pg_stat_activity` wait states, direct concurrent PostgreSQL latency, and concurrent HTTP recall latency; it does not change indexes, pool configuration, or production settings.
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: at concurrency `100` against Docker PostgreSQL and the app on `http://127.0.0.1:3028`, the exact single-query plan used `facts_project_scope_idx` and completed in about `1.52ms`; direct database calls measured p95 `72.43ms`; HTTP recall measured p95 `437.75ms`; failures were `0`; sampled waits were only `ClientRead`. Report: [tier15-postgres-recall-profile-100.json](../../benchmarks/tier15-postgres-recall-profile-100.json).
   - Finding: the SQL plan is not the dominant p95 bottleneck. The remaining delay is above the single-query execution boundary, likely application/request-path or pool scheduling; no speculative pool or index change is justified yet. No production evidence is claimed.

## 2026-10-23 Recall request-stage and pool profiling

- `IMPLEMENTED / TESTED`: `lib/runtime/recall-profiling.ts`, `lib/runtime/api-handlers.ts`, `lib/runtime/repository.ts`, and `app/api/v1/memory/recall/route.ts` now provide opt-in redacted `Server-Timing` stages and PostgreSQL pool counters when `APEX_PROFILE_RECALL=true`; `tests/runtime/recall-profiling.test.ts` covers enabled and disabled behavior.
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: the unchanged 100-concurrency workload completed with zero failures, 100/100 worker completions, zero dead letters, and idempotent duplicate retries. Recall p95 was `565.65ms`, still above the `500ms` target. The profiling run measured direct PostgreSQL p95 `74.32ms` versus HTTP recall p95 `670.54ms`; sample headers showed `poolTotal=5`, `poolWaiting=90-94`, and `sql` stage `312-351ms`, while auth, scope, authorization, repository, and response stages were about `0-7ms`. Reports: [tier15-recall-request-instrumented-workload-100.json](../../benchmarks/tier15-recall-request-instrumented-workload-100.json) and [tier15-recall-request-profile-100.json](../../benchmarks/tier15-recall-request-profile-100.json).
- Finding: the local concurrency-100 miss is pool saturation/request scheduling above PostgreSQL execution, not the SQL plan. The next safe performance experiment is a bounded pool-sizing/queue policy comparison with the same workload and profiling; do not claim production impact or increase workload size yet.

## 2026-10-23 Bounded PostgreSQL pool comparison at concurrency 100

- `IMPLEMENTED / TESTED`: `APEX_DB_POOL_MAX` is now a bounded local-staging override (`1..50`, default `5`) for the canonical PostgreSQL pool; focused repository-boundary tests cover valid, clamped, and invalid values. The default staging configuration remains pool `5` after the experiment.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: identical `100`-concurrency, `100`-iteration workload with duplicate/retry injection was run at pool sizes `5`, `10`, and `20`. Recall p95 was `761.00ms`, `782.76ms`, and `2021.37ms`; queue-delay p95 was `1045ms`, `1142ms`, and `1189ms`; worker completion was `100/100` with zero dead letters in all runs; duplicate retries were `10/10` idempotent. Reports: [pool5](../../benchmarks/tier15-recall-pool5-concurrency-100.json), [pool10](../../benchmarks/tier15-recall-pool10-concurrency-100.json), [pool20](../../benchmarks/tier15-recall-pool20-concurrency-100.json).
- Finding: increasing the pool does not improve this workload and pool `20` materially worsens recall latency. Keep pool `5` as the local baseline; next investigate query/request queue shaping or bounded concurrency rather than increasing pool size. No production evidence is claimed.

## 2026-10-23 Recall request concurrency shaping

- `IMPLEMENTED / TESTED`: `lib/runtime/recall-scheduler.ts` adds a FIFO bounded scheduler for recall work, configured by local-only `APEX_RECALL_CONCURRENCY` and defaulting to `100` so normal behavior is unchanged. `tests/runtime/recall-scheduler.test.ts` verifies the active limit and FIFO admission.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: with PostgreSQL pool fixed at `5`, valid queue-limit runs at `10` and `20` completed the unchanged 100-concurrency workload with zero failures, 100/100 worker completion, zero dead letters, and 10/10 idempotent duplicate retries. Recall p95 was `661.02ms` at queue `10` and `666.61ms` at queue `20`; queue-delay p95 was `918ms` and `924ms`. Neither cleared the `500ms` recall target. The queue `5` run had 29 event failures and only 75 accepted events, so it is excluded from comparison. Reports: [queue10](../../benchmarks/tier15-recall-queue10-concurrency-100.json) and [queue20](../../benchmarks/tier15-recall-queue20-concurrency-100.json).
- Finding: bounded recall concurrency reduces instability relative to the pool-size experiment but is not sufficient to meet the SLO. Restore the default queue limit `100`; next isolate per-request query cost/payload and application runtime overhead rather than changing pool size or increasing workload. No production evidence is claimed.

## 2026-10-23 Recall work and response-payload isolation

- `IMPLEMENTED / TESTED`: profiling now measures recall fact count, evidence count, and serialized response bytes; `lib/runtime/recall-response-metrics.ts` and `tests/runtime/recall-response-metrics.test.ts` cover the measurement contract. The profile harness accepts `SLO_RECALL_LIMIT` without changing the API default.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: on the same populated staging project at concurrency `100`, limit `10` returned p95 `10` facts, `10` evidence IDs, and `9,730` response bytes with HTTP p95 `743.75ms`; limit `1` returned p95 `1` fact, `1` evidence ID, and `1,151` bytes with HTTP p95 `527.47ms`. Both had zero request failures. The SQL plan remained about `2ms`, while sampled pool wait stayed high, so payload reduction materially helped but did not clear the `500ms` target. Reports: [limit10](../../benchmarks/tier15-recall-payload-limit10-100.json) and [limit1](../../benchmarks/tier15-recall-payload-limit1-100.json).
- Finding: response size is a real contributor, but pool scheduling remains the dominant local constraint. Keep the full response contract and default limit unchanged; the next safe product experiment is an explicitly named lightweight recall projection or pagination contract, followed by another concurrency-100 benchmark. No production evidence is claimed.

## 2026-10-23 Explicit recall projection benchmark

- `IMPLEMENTED / TESTED`: the recall API now accepts `projection: "full" | "summary"`; `full` remains the default and `summary` explicitly omits evidence IDs and packed context while preserving fact identity, claim, confidence, and timestamps. Handler coverage verifies the summary contract. The profile harness now measures projection-specific response size.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: at concurrency `100`, limit `10`, and the same populated staging project, `full` measured HTTP p95 `589.88ms` and response-size p95 `9,750 bytes`; `summary` measured HTTP p95 `649.79ms` and response-size p95 `4,090 bytes`. Both had zero failures; summary returned p95 `10` facts and `0` evidence IDs. The single-query plan remained about `1.5–2.4ms`, with pool wait still observed. Reports: [full](../../benchmarks/tier15-recall-projection-full-100.json) and [summary](../../benchmarks/tier15-recall-projection-summary-100.json).
- Finding: summary projection reduces payload size by about `58%` but did not improve this noisy single-run HTTP p95, so it is a contract/payload optimization rather than a proven SLO fix. Keep it opt-in; do not change the default projection or claim the `500ms` target is cleared. No production evidence is claimed.

## 2026-10-23 Candidate-first full recall query

- `IMPLEMENTED / TESTED`: `PostgresRepository.searchFacts` now selects scoped, non-deleted, bounded fact candidates before joining `fact_evidence`; the repository regression test verifies the candidate-first query shape and evidence join.
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: the live candidate-first plan returned the same 10 facts with `0.599ms` execution time and `49` shared buffers, versus the prior approximately `1.5–2.4ms` and `78` buffers. At concurrency `100`, full recall had zero failures, facts/evidence p95 `10/10`, response-size p95 `9,738` bytes, and HTTP p95 `657.67ms`; this single run did not clear the `500ms` target, so the SQL improvement is not being promoted as an end-to-end SLO fix. Report: [tier15-recall-candidate-first-100.json](../../benchmarks/tier15-recall-candidate-first-100.json).
- Finding: database assembly work is measurably reduced, but pool/request scheduling still dominates HTTP latency. Keep the SQL change because it lowers query work without changing the response contract; further SLO work should focus on application connection acquisition and repeated-run variance. No production evidence is claimed.

## 2026-10-23 local benchmark, variance, and browser completion sweep

- `IMPLEMENTED / TESTED / BENCHMARK VERIFIED / LOCALLY VERIFIED`: the Tier-1.5 report now pins Scenario A three-project isolation with an explicit Alpha-to-Beta contamination rejection, Scenario B long-context retrieval metadata (`4,096` source tokens, precision/recall `1.0`), and Scenario C supersession reconstruction (`GraphQL` superseded by `gRPC + REST`). It also pins prompt version, PostgreSQL storage, deterministic zero-cost collection, seed, generated timestamp, corpus hash, configuration hash, and replay hash. Fixed local run: `9` cases; leakage `0`; temporal lineage `1`; adversarial rejection `1`; p50/p95/p99 `24/36/36ms`; canonical writes `0`. Report: [tier15-phase-1-3-5-report.json](../../benchmarks/tier15-phase-1-3-5-report.json). This is deterministic local-fixture evidence, not live provider, connector, or production quality evidence.
- `IMPLEMENTED / TESTED / BENCHMARK VERIFIED / LOCALLY VERIFIED`: `quality:tier15:profile-repeat` preserves every individual profile and aggregates run-level p95 results without hiding failures. Five unchanged full-projection concurrency-100 runs had zero request failures and recall p95 values `667.81`, `588.44`, `497.24`, `509.14`, and `456.38ms`; p50/p95/p99 of run p95 were `509.14/667.81/667.81ms`. The strict all-runs-under-`500ms` gate is `false`. Query execution remained approximately `0.59–0.98ms`; request variation still coincided with pool waiting up to `44`. Report: [tier15-recall-repeat-100.json](../../benchmarks/tier15-recall-repeat-100.json). The recall SLO remains `IN PROGRESS`.
- `BROWSER VERIFIED`: the review journey now creates unique, provenance-linked conflicting local records through the authenticated import boundary instead of skipping when staging has no reviewable record. Chromium and mobile both completed conflict creation, review mutation, durable event readback, and markdown export. Full Playwright passed `24/24`, including graph temporal/as-of retrieval, approval/replay coverage, responsive keyboard/reduced-motion checks, and serious/critical axe checks.
- Current local boundary: do not increase workload size. The next performance slice is connection-acquisition/request scheduling diagnosis or a measured runtime-level mitigation; production, non-Codex connectors, and provider quality remain separate holds.

## 2026-10-23 recall connection-acquisition diagnosis

- `IMPLEMENTED / TESTED`: opt-in recall profiling now separates PostgreSQL client acquisition (`connection`) from query execution (`query`) and always releases a profiled client. Unprofiled reads retain the existing `Pool.query` path. The profile report aggregates redacted p50/p95/p99/max stage durations without retaining request contents.
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: the unchanged local Docker/PostgreSQL workload used concurrency `100`, pool `5`, full projection, and recall limit `10`. It completed with zero failures and HTTP p95 `672.44ms`. Stage p95 values were queue `206.25ms`, connection acquisition `313.05ms`, query execution `22.03ms`, and response serialization `0.80ms`; direct database p95 was `88.28ms` and the query plan executed in `0.768ms`. Report: [tier15-recall-connection-acquisition-100.json](../../benchmarks/tier15-recall-connection-acquisition-100.json).
- Finding: database query work and response serialization are not the primary blocker. The measured constraint is application-side queueing plus waiting for a bounded PostgreSQL client. This is one local measurement, not a production claim; the strict all-runs-under-`500ms` recall SLO remains `IN PROGRESS`.
- Next safe boundary: keep workload and pool bounds fixed, then test one request-admission or client-lease scheduling mitigation at a time against the same concurrency-100 workload. Do not increase pool size or workload size before that measured comparison.

## 2026-10-23 pool-matched recall admission experiment

- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: the existing FIFO recall scheduler was temporarily set to admission limit `5`, matching the unchanged PostgreSQL pool size `5`. The identical concurrency-100, full-projection, limit-10 workload completed with zero failures; HTTP p95 was `863.27ms`, queue p95 was `400.43ms`, connection-acquisition p95 was `17.23ms`, query p95 was `42.05ms`, and response p95 was `1.03ms`. Report: [tier15-recall-admission5-100.json](../../benchmarks/tier15-recall-admission5-100.json).
- Finding: pool-matched admission removed observed pool waiting (`poolWaiting=0`) but shifted the delay into the application queue and worsened HTTP p95 versus the unchanged-admission baseline (`672.44ms`). The experiment is rejected as an SLO mitigation; the staging app was restored to `APEX_RECALL_CONCURRENCY=100` and `APEX_DB_POOL_MAX=5`, with health HTTP `200` verified.
- Next safe boundary: do not keep admission `5`, increase pool size, or increase workload size. The next diagnosis should measure client lease fairness or request scheduling overhead at the existing admission default before selecting another mitigation. No production evidence is claimed.

## 2026-10-23 client-lease fairness and scheduling diagnosis

- `IMPLEMENTED / TESTED`: the repeated-profile aggregator now retains per-run p95 stage tails for queue admission, PostgreSQL client acquisition, query execution, and response serialization. This is diagnostic reporting only; scheduler, pool, workload, and full recall behavior were unchanged.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: five unchanged default runs used admission `100`, pool `5`, concurrency `100`, full projection, and limit `10`. All had zero request failures. HTTP p95 values were `683.75`, `586.25`, `592.35`, `596.94`, and `590.12ms`; p50/p95/p99 of run p95 were `592.35/683.75/683.75ms`. Queue p95 ranged `113.03–186.90ms`; connection-acquisition p95 ranged `220.70–362.54ms`; query p95 ranged `22.26–131.91ms`; response p95 stayed `0.72–0.99ms`. Report: [tier15-recall-fairness-repeat-100.json](../../benchmarks/tier15-recall-fairness-repeat-100.json).
- Finding: repeated evidence supports client acquisition as the larger and more variable scheduling component than the application admission queue. This identifies the bottleneck but does not prove a fairness defect or justify changing pool behavior. The recall SLO remains `IN PROGRESS`.
- Next safe boundary: add client-lease wait ordering/age diagnostics or a bounded lease-fairness experiment without changing pool size, admission limit, workload size, or response contract. No production evidence is claimed.

## 2026-10-23 client-lease ordering diagnostics and FIFO baseline

- `IMPLEMENTED / TESTED`: profiled recall reads now emit a redacted monotonic lease sequence and lease wait age alongside the existing stage timing and pool counters. This exposes acquisition ordering and age without logging scope, query, or response content.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: rebuilt local staging and ran the unchanged concurrency-100, admission-100, pool-5, full-projection, limit-10 workload using the existing FIFO scheduler/pool behavior. The run had zero failures; HTTP p95 was `1339.66ms`, queue p95 `0.09ms`, lease-wait/connection p95 `177.43ms`, query p95 `54.52ms`, and response p95 `1.48ms`. Sampled headers contained lease sequences and ages, including sequence `1` with `196.50ms` wait and sequence `2` with `201.60ms` wait. Report: [tier15-recall-fifo-lease-100.json](../../benchmarks/tier15-recall-fifo-lease-100.json).
- Finding: the current FIFO path is observable but not yet proven fair; this single run shows substantial request-level variance above the SQL plan. No lease policy change was retained, and the recall SLO remains `IN PROGRESS`.
- Next safe boundary: run a repeated FIFO baseline with lease sequence/age distributions, then compare one explicit fairness policy. Keep pool `5`, admission `100`, workload size, and response contract fixed. No production evidence is claimed.

## 2026-10-23 repeated FIFO lease-age analysis and fairness-policy evaluation

- `IMPLEMENTED / TESTED`: `summarizeRecallLeaseFairness` parses redacted lease sequence and wait-age metadata, reports wait p50/p95/p99/max, sample count, maximum sequence, and observed sequence inversions. The repeat harness now preserves this per-run fairness summary.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: five unchanged runs at concurrency `100`, admission `100`, pool `5`, full projection, and limit `10` completed with zero failures. HTTP p95 was `469.56/522.88/579.30/607.34/530.98ms`; aggregate p95-of-run-p95 was `607.34ms`, so the strict `500ms` recall SLO remains failed. Lease wait p95 ranged `195.99–269.22ms`; observed sequence inversions ranged `19–24` per 100 captured requests, so the current path is not proven FIFO at request-observation order. Report: [tier15-recall-fifo-lease-repeat-100.json](../../benchmarks/tier15-recall-fifo-lease-repeat-100.json).
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: the explicit fairness policy evaluated was the existing FIFO application admission/lease path with unchanged bounds. It did not change pool size, admission, workload, or response contract, and no replacement policy is retained because this comparison did not clear the SLO or establish a fairness win.
- Remaining local order: complete dedicated browser/operator journeys and deterministic approval/replay coverage. External provider, non-Codex connector, and production verification remain authorization-bound and unclaimed.

## 2026-10-23 browser/operator and deterministic replay refresh

- `BROWSER VERIFIED / LOCALLY VERIFIED`: fresh `npm run test:e2e` passed `24/24` across Chromium and mobile. Coverage included temporal graph/as-of evidence, operator audit/events/manifest/trace, evidence-linked review mutation, authenticated retain→recall→trace→correct→replay→evaluate diagnosis, proposal-only rejection, responsive layouts, keyboard/focus/reduced-motion behavior, and serious/critical axe checks.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: fresh `npm run quality:slice4:report` persisted `512` deterministic cases with grounded accuracy `1`, citation precision `1`, unsupported-claim rate `0`, graph accuracy `1`, and p50/p95 latency `18/26ms`. Fresh `npm run quality:slice4:replay` persisted `24` runs, `12` proposals, `12` comparisons, and `12` workflows; all `11` categories improved without regression.
- Local browser/operator and deterministic approval/replay coverage is complete for the available staging path. External provider quality, independent non-Codex connector evidence, and production deployment verification remain pending authorization; no such evidence is claimed.

## 2026-10-23 neutral agent-memory benchmark baseline

- `IMPLEMENTED / TESTED`: `lib/runtime/neutral-memory-benchmark.ts` defines a provider-neutral adapter identity/capability contract and explicit unsupported-operation results. Unsupported systems are never scored as zero or pass.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: `npm run quality:neutral:baseline` generated [neutral-agent-memory-baseline.json](../../benchmarks/neutral-agent-memory-baseline.json) from the fixed Tier-1.5 corpus (`9` cases, deterministic seed/timestamp/replay hash). Local metrics: namespace leakage `0`, temporal lineage `1`, adversarial rejection `1`, citation coverage `1`, unsupported claims `0`, p50/p95/p99 `24/36/36ms`, worker completion `1`, canonical writes `0`.
- `IMPLEMENTED / NOT RUN`: Mem0, Zep, Letta, and Hindsight are registered in the normalized comparison manifest as `NOT RUN — AUTH/ADAPTER REQUIRED`; no external quality, latency, cost, connector, or production claim is made.
- Next safe boundary: implement and validate one equivalent adapter at a time, beginning with the systems for which an authorized endpoint and comparable operation contract are available; then rerun the same corpus before adding concurrency or failure injection.

## 2026-10-23 Zep adapter readiness probe

- `IMPLEMENTED / TESTED`: `lib/runtime/zep-adapter.ts` implements the official Zep v4 user/thread/message/context boundary with API-key authentication, RFC3339 reference-time preservation, and redacted provider errors. Focused adapter tests passed `2/2`.
- `LOCALLY VERIFIED`: after correcting the local probe to strip the complete `ZEP_API_KEY=` prefix and using the project key shown in the Zep API Keys page, Zep returned `201 Created`; the disposable end-to-end probe created a synthetic user/thread, accepted one timestamped message, returned context, and deleted the user with `202 Accepted`. No benchmark corpus was sent.
- `IMPLEMENTED / TESTED / LOCALLY VERIFIED`: the adapter tests passed `2/2`, typecheck passed, and the adapter now uses Zep v4-generated user/thread UUIDs and optional developer `user_id` values as required by the API. `LIVE CONNECTOR VERIFIED` remains unclaimed for the full benchmark because only the disposable probe has run.
- Next action: run the fixed neutral corpus through Zep with per-case synthetic users/threads, wait for asynchronous processing, collect context/latency, and delete the test users after readback.

## 2026-10-23 Zep neutral benchmark

- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED / LOCALLY VERIFIED`: `npm run quality:zep:benchmark` ran the fixed `9`-case Tier-1.5 corpus through isolated Zep v4 users and threads using synthetic content and fixed timestamps. All `9` cases returned context; context hit rate was `1.0`; p50/p95 latency was `2208.97/3256.85ms`; failures were `0`.
- `IMPLEMENTED / TESTED`: the benchmark script records redacted per-case results and issues user deletion requests in a `finally` cleanup path. Cleanup was attempted for every created user; deletion completion was not independently polled, so deletion is not claimed as fully verified.
- `PRODUCTION VERIFIED`: false. This is a small authorized provider benchmark, not production evidence and not a claim of superiority over other systems. Cost reporting is unavailable from this run; the authorized ceiling was `$5`.

## 2026-10-23 Zep repeat, cleanup, and failure-boundary sweep

- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED`: three repeated identical Zep runs completed with `9/9` cases, context hit rate `1.0`, and zero failures. p50 latency was `2191.04/2217.14/2213.72ms`; p95 was `2694.01/2777.64/2694.18ms`.
- `LIVE CONNECTOR VERIFIED`: the refreshed primary report independently read each deletion target after the `202 Accepted` request; all `9/9` test users were confirmed absent (`404`). Report: [zep-neutral-benchmark.json](../../benchmarks/zep-neutral-benchmark.json).
- `IMPLEMENTED / TESTED`: normalized reports now share corpus identity, case count, context-hit rate, p50/p95 latency, failures, and explicit evidence labels. Citation coverage, unsupported claims, and provider cost remain `unavailable` for Zep context-block output rather than being guessed.
- Remaining item 4: duplicate/retry/timeout concurrency and recovery probes are not yet run. The current Zep adapter test covers redacted error handling; live failure-injection evidence remains pending.

## 2026-10-23 Zep reliability and failure-injection sweep

- `IMPLEMENTED / TESTED`: `lib/runtime/zep-adapter.ts` now applies a bounded `10,000ms` timeout and one retry by default to safe `GET` reads only. `POST` and `DELETE` operations remain single-attempt because this adapter has no verified provider idempotency contract for mutations. Six focused tests passed for timestamp/header preservation, redacted errors, transient `503` retry, `404` no-retry, timeout abort, and report normalization.
- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED / LOCALLY VERIFIED`: one synthetic reliability run recorded two accepted duplicate message writes as `observed` behavior; it does not claim Zep deduplicates those writes. A controlled client-side transient transport failure retried the safe context read once and the second attempt completed against Zep. A controlled stalled transport was aborted at `25ms`. Five isolated users/threads ran concurrently and all five returned non-empty context.
- `LIVE CONNECTOR VERIFIED`: the sweep created six disposable synthetic Zep users and confirmed every one absent by post-deletion `GET` readback (`6/6` `404`). The report had zero failed controls. Report: [zep-reliability-benchmark.json](../../benchmarks/zep-reliability-benchmark.json).
- Evidence limit: retry and timeout injection exercise the client transport control, not a Zep server outage or network partition; duplicate behavior is measured as acceptance only, not idempotency; this is one bounded concurrency-`5` run, not sustained capacity evidence. `PRODUCTION VERIFIED` remains false.

## 2026-10-23 Hindsight adapter and benchmark authorization attempt

- `IMPLEMENTED / TESTED`: added the Hindsight Cloud adapter and fixed neutral-v1 benchmark harness with isolated disposable banks, timestamped retain, recall polling, normalized metrics, and deletion/readback cleanup.
- `LOCALLY VERIFIED`: `.env.local` contains a non-empty Hindsight key with the expected `hsk_` prefix; focused adapter tests and typecheck passed before the live attempt.
- `LIVE CONNECTOR VERIFIED / BENCHMARK VERIFIED`: not achieved. The authorized synthetic run returned HTTP `401` before any corpus case completed; the redacted report records `0` cases and `10` failures. No provider quality, latency, cost, or deletion result is claimed.
- Report: `docs/benchmarks/hindsight-neutral-benchmark.json`. `PRODUCTION VERIFIED` remains false.

## 2026-10-23 governed MCP gateway read-only implementation

- `IMPLEMENTED / TESTED`: the existing `/api/mcp` endpoint is now a typed, session-bound read-only gateway. It exposes `memory_recall`, `memory_trace`, `memory_get_project_state`, and `memory_get_capture_status`; rejects mutation tools; binds provider, agent, tenant, bank, project, and conversation/run context at initialization; and rejects mismatched authenticated-session reuse.
- `IMPLEMENTED / TESTED`: gateway capture now persists a provider-labelled, redacted, deterministic project event before asynchronous queueing. Focused gateway, authorization, capture, and Codex-regression tests passed; TypeScript validation passed.
- Evidence limits: Hermes and OpenCode have not yet connected to the local gateway. `LOCALLY VERIFIED`, `BROWSER VERIFIED`, `BENCHMARK VERIFIED`, `LIVE CONNECTOR VERIFIED`, and `PRODUCTION VERIFIED` remain unclaimed. The local recall SLO remains unresolved.

## Next safe boundary

Confirm the saved Hindsight key is active for the Hindsight Cloud project/API endpoint and has not been revoked or restricted, then rerun the unchanged fixed corpus. Do not paste or print the key.

## 2026-10-23 Phase 1/2 vertical slice checkpoint

`IMPLEMENTED / TESTED`: onboarding now describes a safe-sample-to-real-project path, and retrieval traces expose policy outcome, freshness, exclusions, and graph-hop count. The trace API returns a redacted share URL; `/api/project-memory/trace/share` returns metadata-only, hashed identifiers without memory content or query text. Existing review and replay routes remain the governed correction path.

`PARTIAL`: this establishes the contract boundary, not the complete guided workflow. Browser verification, durable cross-worker telemetry aggregation, data-quality panels, and measured recall cost attribution remain pending.

## 2026-10-23 Developer Workbench checkpoint

`IMPLEMENTED / TESTED`: `/sandbox/developer` now provides one explicit local golden-path workbench with safe sample-project initialization, an explicit switch-to-real-project boundary, workflow progress state, ingest, retain, recall, correction, replay, and evaluation controls. `developer-workflow.ts` supplies the stable `workflowRunId` and step-state contract. Focused workflow tests and typecheck pass.

`PARTIAL`: the current workbench carries `workflowRunId` through its local UI metadata, but server-side durable propagation through every existing API and browser acceptance coverage at all required widths remain the next implementation boundary.

## 2026-10-23 Workflow durability checkpoint

`IMPLEMENTED / TESTED`: recall and trace now echo workflow correlation, PostgreSQL has an additive `workflow_runs` migration with scoped repository upsert/read methods, and `/api/v1/memory/workflow` exposes authenticated durable workflow state with explicit unavailable/unauthorized/empty states. The developer workbench now attempts to persist workflow progress through a typed client and surfaces server unavailability rather than silently claiming durable success. Typecheck and focused migration/repository/API tests pass.

`PARTIAL`: retain, review, replay, and evaluation still persist their individual records but do not yet atomically update `workflow_runs`; the workbench's ingest/retain/recall actions still use the local engine for memory data, and full authenticated responsive browser verification remains pending.

## 2026-10-23 Golden-path durability Steps 2-5 checkpoint

- `IMPLEMENTED`: evaluation now uses `saveEvaluationAtomic(...)` to persist the evaluation run, `EvaluationCompleted` event, outbox record, and final workflow state in one PostgreSQL transaction. Replay no longer performs a best-effort workflow write before its atomic bundle transaction.
- `IMPLEMENTED / TESTED`: the test repository enforces evaluation scope and idempotency; focused repository/API tests passed `19/19`, and TypeScript validation passed.
- `IMPLEMENTED`: evaluation and replay use the shared API envelope. The workflow client now preserves request, workflow, trace, and retry metadata, and the developer workbench reads persisted workflow state on refresh and displays server state, request ID, and event ID.
- `PARTIAL`: correction, retain, recall, trace, and workflow routes still contain legacy response construction; full metadata display for revision IDs, replay comparison, and evaluation before/after metrics remains pending.
- `BROWSER VERIFIED`: not claimed. Authenticated 375/768/1440 journeys, keyboard/reduced-motion checks, accessibility checks, and unavailable/degraded/unauthorized/replay-failure/refresh scenarios remain pending.
- `BENCHMARK VERIFIED`: not claimed for this boundary. `PRODUCTION VERIFIED`: false. External deployment, connector authorization, and provider configuration remain out of scope.
