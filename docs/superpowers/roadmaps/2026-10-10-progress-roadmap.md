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

## 2026-10-10 local operator identity bridge and evidence dashboard

- `IMPLEMENTED / TESTED`: the local-only operator bridge issues an HttpOnly, server-owned session for the allowlisted `staging` scope. Production configuration always requires JWT and cannot enable the development principal, even when `APEX_ALLOW_DEV_PRINCIPAL=true`; local staging is explicitly marked `NODE_ENV=development` in `docker-compose.staging.yml`.
- `IMPLEMENTED / TESTED`: `app/api/local/operator/evidence` reads canonical repository data from the session-bound tenant/bank/project scope and returns only redacted health, event, trace-rationale, conflict, policy, evaluation, and replay summaries with explicit operational states.
- `IMPLEMENTED / TESTED`: protected project routes now apply optional principal bank/project bindings, so changing query parameters cannot cross the server-issued session scope. Anonymous requests remain unauthorized.
- `BROWSER VERIFIED` for the current checkout's local bridge surface: focused Chromium/mobile Playwright passed `4/4` at 375/768/1440 widths with reduced motion, visible focus, and no serious/critical axe violations. It verified deliberate sign-in, dashboard rendering, browser-cookie scope denial, and explicit unauthorized/unavailable states against the checkout-local server on port `3038`.
- Fresh regression evidence: full Vitest passed `78` files / `257` tests with `6` skipped; `npm run typecheck` passed; `git diff --check` passed with existing CRLF conversion warnings only.
- Evidence boundary: the browser run used an intentionally unconfigured local SQLite runtime, so it does not claim PostgreSQL durable readback, staging validation, production authentication, live connector, provider, or deployment evidence.

## 2026-10-10 enterprise visual gallery preview

- `IMPLEMENTED / TESTED`: added the isolated `/sandbox/design-gallery` local preview with a bounded synthetic command-center stream, range/series/pause controls, searchable/filterable/sortable evidence table with detail inspection, and an accessible evidence-topology view. It has no database, evidence-route, connector, or production-authentication dependency.
- `BROWSER VERIFIED`: focused Chromium and mobile Playwright passed `4/4` against this checkout on port `3042`, exercising chart controls, evidence filtering and selection, topology node selection, visible focus, reduced motion, 375/768/1440 widths, and no serious/critical axe violations.
- `TESTED`: focused gallery unit tests passed `5/5`; full Vitest passed `79` files / `262` tests with `6` skipped; TypeScript passed; `git diff --check` passed with existing CRLF conversion warnings only.
- Design boundary: gallery data is explicitly synthetic. It is a visual-selection aid and does not claim live PostgreSQL evidence, a connector feed, production telemetry, benchmark, or deployment verification.

## 2026-10-10 interactive legacy dashboard polish

- `IMPLEMENTED / TESTED`: the existing `/sandbox` Operations timeline now reuses the bounded `LiveObservabilityChart` stream rather than a static SVG snapshot. It preserves the dashboard's layout, colors, historic local-series data, and hover behavior while adding pause/resume, zoom, reset, and chart/table controls. New local sandbox retain, recall, and reflect events append to the visible bounded series.
- `IMPLEMENTED / TESTED`: Four-network mix rows are now keyboard-selectable buttons; selected and hovered networks receive the same visual emphasis. Shared telemetry tables are keyboard-focusable when horizontally or vertically scrollable.
- `BROWSER VERIFIED`: focused dashboard and gallery Playwright checks ran serially on Chromium and mobile against this checkout at port `3042`, with 375/768/1440 layouts, reduced motion, keyboard selection, and zero serious/critical axe violations. Parallel browser execution against the shared development server timed out while rendered pages were otherwise available, so no parallel-load claim is made.
- Fresh regression evidence: focused telemetry/gallery units passed `13/13`; full Vitest passed `79` files / `262` tests with `6` skipped; TypeScript passed. This dashboard consumes browser-local sandbox state and seeded history only. It is not PostgreSQL, connector, production telemetry, benchmark, or deployment evidence.
