# Ray Sandbox OARC — Live Codex Capture New Chat Handoff

Date: 2026-10-23

Project: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`

Branch: `renewal-roadmaps` with a user-owned dirty worktree. Preserve all unrelated changes, `.firecrawl/`, and `test-results/`. Do not reset, clean, delete, or commit unless explicitly authorized.

## Read order

1. `AGENTS.md`
2. `docs/superpowers/PROJECT-CORE-HEART.md`
3. `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`
4. `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
5. This handoff

## Completed in the preceding slice

- `IMPLEMENTED`: the Ray Memory plugin receives `UserPromptSubmit`, `Stop`, and `SessionEnd` lifecycle events. The adapter accepts documented nested hook payload fields and transcript-path aliases.
- `IMPLEMENTED`: capture success now requires the import service to confirm that it accepted every submitted message. Optional diagnostics emit only status, scope, conversation ID, and message count; never message content.
- `IMPLEMENTED`: project/workspace identity hashing normalizes Windows path separators while keeping the source path unchanged for readable provenance.
- `TESTED`: `npm test -- --run tests/runtime/codex-capture.test.ts` passed `6/6`.
- `TESTED`: `npm run typecheck` passed.
- `LOCALLY VERIFIED`: `http://127.0.0.1:3028/sandbox` returned HTTP `200`; `hindsight-memory-slice-postgres-1` was healthy.
- `LIVE CONNECTOR VERIFIED`: a controlled local Codex session persisted the exact user prompt and assistant acknowledgement to PostgreSQL. Readback verified one project scope, user and assistant roles, and `codex-hook` provenance.

## Changed files in this capture slice

- `plugins/ray-memory/hooks/hooks.json`
- `plugins/ray-memory/scripts/capture-event.mjs`
- `plugins/ray-memory/scripts/capture-support.mjs`
- `tests/runtime/codex-capture.test.ts`
- `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- `docs/superpowers/handoffs/2026-10-10-apex-control-plane-next-chat.md`

The local plugin cache was refreshed after the source changes. It is installed as `ray-memory@ray-sandbox-local` and enabled.

## Current evidence boundary

- The verified connector is the local Codex host into local Docker/PostgreSQL staging.
- This is not external deployment or `PRODUCTION VERIFIED` evidence.
- It does not verify ChatGPT web/desktop conversations outside the enabled local Codex host, nor non-Codex connectors.
- The host currently supplies no reliable event timestamp in this path, so some legacy capture records have a fallback timestamp. Do not claim temporal-accuracy benchmark evidence from this connector run.

## Recommended next boundary

Build the missing benchmark readback fixtures before comparing against other memory frameworks:

1. Versioned Scenario A isolation corpus with three projects and explicit contamination assertions.
2. Scenario B long-context recall fixture with retrieval precision/recall and latency measurements.
3. Scenario C supersession timeline fixture with temporal decision reconstruction assertions.
4. Pin competitor versions, models, prompts, storage settings, corpus hashes, and cost/token collection rules.
5. Report separate local, live-connector, and production evidence categories. Keep production unverified unless separately authorized and exercised.

## Required operating rules

- PostgreSQL remains the canonical durable store.
- Preserve source provenance, tenant/bank/project/conversation scope, idempotency, and append-only event history.
- Never print secrets, `.env` values, raw transcripts, or user conversation content.
- Use exact evidence labels: `IMPLEMENTED`, `TESTED`, `LOCALLY VERIFIED`, `BROWSER VERIFIED`, `BENCHMARK VERIFIED`, `LIVE CONNECTOR VERIFIED`, and `PRODUCTION VERIFIED`.
- Do not deploy, publish, change provider configuration, spend on a provider, or perform destructive cleanup without explicit user authorization.

## 2026-10-23 local completion sweep

- `IMPLEMENTED / TESTED / BENCHMARK VERIFIED / LOCALLY VERIFIED`: `lib/runtime/tier15-benchmark.ts` now emits deterministic Scenario A/B/C fixture metadata and actual controls: three project scopes with a denied contamination attempt, a `4,096`-token long-context retrieval control, and a supersession reconstruction. The fixed `local-abc-v1` report has `9` cases, zero leakage, full temporal/adversarial metrics, zero canonical writes, and pinned corpus/config/replay hashes. See `docs/benchmarks/tier15-phase-1-3-5-report.json`.
- `IMPLEMENTED / TESTED / BENCHMARK VERIFIED / LOCALLY VERIFIED`: `lib/runtime/recall-profile-repeat.ts` and `scripts/postgres-recall-profile-repeat.mjs` aggregate repeated unchanged concurrency-100 profiles while retaining each run report. Five runs had zero HTTP failures but p95 variance from `456.38ms` to `667.81ms`; aggregate p95-of-run-p95 was `667.81ms`, so the all-runs-under-`500ms` SLO remains failed. See `docs/benchmarks/tier15-recall-repeat-100.json`.
- `BROWSER VERIFIED`: `tests/e2e/operator-review.spec.ts` now seeds a unique conflict through the authenticated import path, performs a visible review mutation, verifies the durable review event, and verifies the markdown export. The full Chromium/mobile Playwright suite passed `24/24`.

## Next safe boundary

Keep the current PostgreSQL pool and full recall contract unchanged. Diagnose connection acquisition and request scheduling variance with the preserved repeated-run reports before increasing workload size. Do not claim the recall SLO, provider quality, non-Codex connector coverage, or production verification as complete.

## 2026-10-23 connection-acquisition diagnosis

- `IMPLEMENTED / TESTED`: profiling now splits PostgreSQL client acquisition from query execution and releases every profiled client. The normal unprofiled `Pool.query` path remains unchanged. The report aggregates redacted stage percentiles rather than retaining request data.
- `LOCALLY VERIFIED / BENCHMARK VERIFIED`: one unchanged concurrency-`100`, pool-`5`, full-projection run had zero failures and HTTP recall p95 `672.44ms`. Its p95 stages were queue `206.25ms`, client acquisition `313.05ms`, query `22.03ms`, and response serialization `0.80ms`; direct PostgreSQL p95 was `88.28ms`; the plan executed in `0.768ms`. See `docs/benchmarks/tier15-recall-connection-acquisition-100.json`.
- Evidence-bounded conclusion: SQL execution and response serialization are not the dominant local p95 contributors. Request admission and client-acquisition scheduling are the measured constraint. The strict recall SLO remains failed, and this result is not production, provider, or non-Codex connector evidence.

## Revised next safe boundary

Keep workload size, pool bounds, and the full recall contract fixed. Compare one request-admission or client-lease scheduling mitigation at a time against the same concurrency-`100` workload, with the current report as baseline. Do not increase pool size or workload size first.

## Pool-matched admission result

- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: a temporary recall admission limit of `5` against the unchanged pool `5` and identical full-projection concurrency-`100` workload produced zero failures but HTTP p95 `863.27ms`. Queue p95 was `400.43ms`, connection p95 `17.23ms`, query p95 `42.05ms`, and response p95 `1.03ms`; observed pool waiting was `0`. Report: `docs/benchmarks/tier15-recall-admission5-100.json`.
- Decision: reject this mitigation. It removed pool waiting but moved the latency into the request queue and worsened the baseline HTTP p95 of `672.44ms`. The local app is restored and verified with `APEX_RECALL_CONCURRENCY=100`, `APEX_DB_POOL_MAX=5`, and health HTTP `200`.

## Revised next safe boundary

Keep the default admission limit, pool bounds, workload size, and full recall contract unchanged. Investigate client-lease fairness or request scheduling overhead with instrumentation before attempting another mitigation. The recall SLO remains unpassed; production, provider, and non-Codex connector evidence remain unclaimed.

## Client-lease fairness diagnosis

- `IMPLEMENTED / TESTED`: repeat benchmark output now preserves per-run p95 tails for queue, client acquisition, query, and response stages.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: five unchanged runs at admission `100`, pool `5`, concurrency `100`, full projection, and limit `10` had zero request failures. HTTP p95 was `683.75/586.25/592.35/596.94/590.12ms`; queue p95 was `113.03–186.90ms`; connection-acquisition p95 was `220.70–362.54ms`; query p95 was `22.26–131.91ms`; response p95 was `0.72–0.99ms`. See `docs/benchmarks/tier15-recall-fairness-repeat-100.json`.
- Evidence-bounded conclusion: client acquisition remains the larger and more variable measured tail than admission queueing. No fairness defect is claimed yet, and no runtime tuning was retained.

## Revised next safe boundary

Keep admission `100`, pool `5`, workload size, and the full recall contract unchanged. Add client-lease wait ordering/age diagnostics, then test one fairness-oriented lease policy against this baseline. The recall SLO remains unpassed; production, provider, and non-Codex connector evidence remain unclaimed.

## Client-lease diagnostics and FIFO baseline

- `IMPLEMENTED / TESTED`: profiled PostgreSQL reads now emit redacted monotonic lease sequence and lease wait age metadata. No content or scope data is emitted.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: rebuilt staging and ran the unchanged full-projection concurrency-100 workload with admission `100` and pool `5`. Zero failures; HTTP p95 `1339.66ms`; queue p95 `0.09ms`; lease wait/connection p95 `177.43ms`; query p95 `54.52ms`; response p95 `1.48ms`. Sampled lease ages included `196.50ms` at sequence `1` and `201.60ms` at sequence `2`. Report: `docs/benchmarks/tier15-recall-fifo-lease-100.json`.
- Evidence limit: this is one high-variance local FIFO observation, not proof of fairness or an SLO pass. No runtime lease policy change was retained.

## Revised next safe boundary

Run repeated FIFO baselines with lease sequence/age distribution analysis, then compare one explicit fairness policy while preserving pool `5`, admission `100`, workload size, and the full recall contract.

## Repeated FIFO lease-age analysis and fairness-policy evaluation

- `IMPLEMENTED / TESTED`: lease fairness reporting now summarizes wait-age percentiles, sequence range, sample count, and observed sequence inversions; repeated reports retain the per-run values.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: five unchanged full-projection concurrency-100 runs with admission `100`, pool `5`, and limit `10` had zero failures. HTTP p95: `469.56/522.88/579.30/607.34/530.98ms`; p95-of-run-p95: `607.34ms`; lease wait p95: `195.99–269.22ms`; lease sequence inversions: `19–24` in the reported 100-sample runs. Report: `docs/benchmarks/tier15-recall-fifo-lease-repeat-100.json`.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: evaluated the explicit existing FIFO admission/lease policy against the unchanged baseline. No pool, admission, workload, or response-contract change was retained; the recall SLO remains unpassed and fairness improvement is not proven from these observations.
- Next local boundary: dedicated browser/operator journeys, then deterministic approval/replay coverage. External provider, non-Codex connector, and production verification remain pending authorization.

## Browser/operator and deterministic replay refresh

- `BROWSER VERIFIED / LOCALLY VERIFIED`: fresh `npm run test:e2e` passed `24/24` across Chromium and mobile, covering temporal graph/as-of retrieval, operator audit/events/manifest/trace, review mutation, diagnosis retain→recall→trace→correct→replay→evaluate, proposal-only rejection, responsive/accessibility behavior, keyboard/focus, and reduced motion.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: fresh deterministic evaluation persisted `512` cases with grounded accuracy `1`, citation precision `1`, unsupported claims `0`, graph accuracy `1`, and p50/p95 latency `18/26ms`. Replay persisted `24` runs, `12` proposals, `12` comparisons, and `12` workflows across `11` categories, all improved without regression.
- Boundary complete: available local browser/operator and deterministic approval/replay coverage is complete. Provider, non-Codex connector, and production verification remain authorization-bound and unclaimed.

## Neutral agent-memory benchmark baseline

- `IMPLEMENTED / TESTED`: added `lib/runtime/neutral-memory-benchmark.ts` with normalized adapter identity/capabilities and explicit unsupported-operation results.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: `npm run quality:neutral:baseline` produced `docs/benchmarks/neutral-agent-memory-baseline.json` from the fixed Tier-1.5 corpus: `9` cases; leakage `0`; temporal lineage `1`; adversarial rejection `1`; citation coverage `1`; unsupported claims `0`; p50/p95/p99 `24/36/36ms`; worker completion `1`; canonical writes `0`.
- `IMPLEMENTED / NOT RUN`: Mem0, Zep, Letta, and Hindsight are present only as capability-gated comparison entries marked `NOT RUN — AUTH/ADAPTER REQUIRED`. No external comparison claim is made.
- Next boundary: add one authorized equivalent adapter at a time, rerun the fixed corpus, and only then expand to concurrency and failure injection.

## Zep adapter readiness probe

- `IMPLEMENTED / TESTED`: `lib/runtime/zep-adapter.ts` targets Zep v4 users, threads, timestamped messages, and context retrieval; focused tests passed `2/2` with redacted errors.
- `LOCALLY VERIFIED`: after correcting the probe parsing and using the project API key, Zep returned `201 Created`; a disposable end-to-end synthetic user/thread/message/context flow passed and cleanup returned `202 Accepted`. No benchmark corpus was sent.
- `IMPLEMENTED / TESTED / LOCALLY VERIFIED`: adapter tests passed `2/2` and typecheck passed. Full Zep benchmark evidence remains unclaimed; only the disposable connector probe is verified.
- Next boundary: run the fixed neutral corpus through per-case Zep users/threads, wait for asynchronous processing, measure normalized recall/context metrics, and delete test users after readback.

## Zep neutral benchmark

- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED / LOCALLY VERIFIED`: fixed `9`-case Tier-1.5 corpus ran through isolated Zep v4 users/threads. All cases returned context; context hit rate `1.0`; p50/p95 latency `2208.97/3256.85ms`; failures `0`. Report: `docs/benchmarks/zep-neutral-benchmark.json`.
- Cleanup deletion requests were issued for every created user in `finally`; deletion completion was not independently polled. `PRODUCTION VERIFIED` remains false. No superiority claim is made; cost was not returned by the provider run.

## Zep repeat, cleanup, and failure-boundary sweep

- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED`: three identical 9-case Zep runs had context hit rate `1.0` and zero failures. p50 latency: `2191.04/2217.14/2213.72ms`; p95: `2694.01/2777.64/2694.18ms`.
- `LIVE CONNECTOR VERIFIED`: refreshed run confirmed all `9/9` test users absent after deletion (`404`).
- `IMPLEMENTED / TESTED`: normalized fields now include corpus identity, case count, context hit rate, p50/p95 latency, failures, and evidence labels. Zep citation/unsupported-claim/cost fields remain unavailable, not zero.
- Still pending: live duplicate/retry/timeout/concurrency/recovery probes. Production remains unverified.

## Zep reliability and failure-injection sweep

- `IMPLEMENTED / TESTED`: `lib/runtime/zep-adapter.ts` adds a bounded `10,000ms` timeout and one default retry for safe `GET` reads. Mutating requests remain single-attempt because Zep mutation idempotency is not established here. Focused tests cover transient retry, `404` no-retry, timeout abort, and report normalization.
- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED / LOCALLY VERIFIED`: one synthetic run observed two accepted duplicate message writes, completed a one-time client-side transient-read retry on its second attempt, aborted a controlled stalled transport at `25ms`, and completed five isolated concurrent user/thread context reads.
- `LIVE CONNECTOR VERIFIED`: all six disposable synthetic users created by the sweep were deleted and independently confirmed absent by `GET` readback (`6/6` `404`). Report: `docs/benchmarks/zep-reliability-benchmark.json`.
- Evidence limit: the duplicate result is acceptance only, not an idempotency claim; retry and timeout are client transport controls rather than a provider outage simulation; concurrency is a bounded five-case run, not sustained capacity or production evidence. `PRODUCTION VERIFIED` remains false.

## Hindsight adapter and benchmark status

- `IMPLEMENTED / TESTED`: Hindsight Cloud adapter and fixed neutral-v1 benchmark harness exist with isolated disposable banks, timestamped retain, recall polling, normalized metrics, and cleanup/readback logic.
- `LOCALLY VERIFIED`: the local secret is present and has the expected `hsk_` format; focused adapter tests and typecheck passed.
- `LIVE CONNECTOR VERIFIED / BENCHMARK VERIFIED`: not achieved. The live authorized run returned HTTP `401` before any corpus case completed; report records `0` cases and `10` failures. No Hindsight quality, latency, cost, or deletion claim is made.
- Report: `docs/benchmarks/hindsight-neutral-benchmark.json`.
- Next boundary: verify the Hindsight Cloud key is active for the configured project/API endpoint, then rerun the unchanged fixed corpus. Keep the key out of chat, reports, and Git. Production verification remains unclaimed.

## Next safe boundary

The authorized Zep reliability slice is complete. The next provider-comparison work requires credentials and comparable operation mappings for one additional provider (Mem0, Letta, or Hindsight). Production deployment verification remains separately authorization-bound.
