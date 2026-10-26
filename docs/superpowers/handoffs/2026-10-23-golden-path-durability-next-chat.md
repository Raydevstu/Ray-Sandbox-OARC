# Golden Path Durability — New Chat Handoff

Date: 2026-10-23  
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`  
Scope: server-backed developer golden path, durable workflow correlation, and acceptance evidence

## 2026-10-23 implementation update

- `IMPLEMENTED`: Phase 1 envelope adoption is present across the primary memory/workflow routes.
- `IMPLEMENTED`: Developer Workbench now hydrates durable workflow progress, exposes an explicit server refresh action, and preserves request/workflow/event/revision metadata.
- `TESTED`: `npm test` — 106 files passed, 2 skipped; 349 tests passed, 6 skipped.
- `TESTED`: `npm run typecheck` passed.
- `LOCALLY VERIFIED`: staging app image rebuilt and restarted with Docker Compose.
- `BROWSER VERIFIED`: `E2E_BASE_URL=http://127.0.0.1:3028 npm run test:e2e` — 36 passed across Chromium and mobile coverage.
- `IMPLEMENTED`: authenticated session scope now supplies the workbench tenant and bank instead of relying on the local fallback scope.
- `TESTED`: workflow GET preserves `retryable` metadata through the client boundary.
- `BROWSER VERIFIED`: focused diagnosis coverage — 4 passed; full suite now 38 passed across Chromium and mobile coverage.
- `PRODUCTION VERIFIED`: not claimed.

The Phase 2 persistence boundary is implemented through the repository atomic evaluation/replay bundles; the remaining release boundary is broader browser coverage for successful reload/resume and additional failure-state permutations.

## Continuation objective

Finish the durable workflow slice so a developer can use one workbench end to end:

`connect → ingest → retain → recall → inspect trace → correct → replay → evaluate`

The next chat must preserve the current dirty worktree. Do not reset, clean, commit, deploy, publish, authorize new connectors, or overwrite unrelated user changes.

## Evidence legend

- `IMPLEMENTED`: source contract or behavior exists.
- `TESTED`: focused automated tests passed.
- `LOCALLY VERIFIED`: a real local runtime/database path was exercised.
- `BROWSER VERIFIED`: an authenticated browser journey passed.
- `BENCHMARK VERIFIED`: a defined workload/corpus was measured.
- `PRODUCTION VERIFIED`: not claimed unless an authorized external deployment is exercised.

## Current repository state

The worktree is intentionally dirty from the ongoing slice. Important changed/untracked areas include:

- `app/sandbox/developer/` — developer workbench route/page.
- `lib/runtime/developer-workflow.ts` — workflow steps and stable `workflowRunId` contract.
- `lib/runtime/developer-workflow-client.ts` — typed client for workflow APIs.
- `lib/runtime/workflow-run-service.ts` — durable workflow read/update helpers.
- `lib/runtime/repositories/interfaces.ts`, `postgres.ts`, `test-double.ts` — repository contracts and implementations.
- `db/migrations/0013_workflow_runs.sql` — additive workflow-run persistence migration.
- `app/api/v1/memory/workflow/` — authenticated workflow state endpoint.
- `lib/runtime/api-envelope.ts` — shared response-envelope helper, currently added but not fully adopted.
- replay/evaluate/trace/review/retain routes and related tests.

Inspect `git status --short` and the latest diff before editing. Treat all existing changes as user-owned.

## What is implemented

### Workflow and onboarding

- `/sandbox/developer` exists as the single developer-facing golden-path workbench.
- Onboarding describes safe sample-project initialization and an explicit switch to a real project.
- The workbench tracks workflow progress and a stable `workflowRunId` in local state.
- The typed client can call workflow persistence, retain, recall, correction, replay, and evaluation endpoints.
- The workbench surfaces canonical-store unavailability instead of silently presenting a failed durable operation as success.

### Durable workflow persistence

- `workflow_runs` migration and scoped repository read/upsert methods exist.
- Recall and trace carry/echo workflow correlation where supported.
- `/api/v1/memory/workflow` returns authenticated durable workflow state with explicit unavailable, unauthorized, and empty states.
- Retain has an atomic repository path that can persist the workflow update with the retained memory/event mutation.
- Correction now has `correctMemoryAtomic(...)` in the repository interface, PostgreSQL implementation, and test double. It writes facts/evidence, revision/event/outbox, and optional workflow state in one transaction.
- Replay has `saveEvaluationBundleAtomic(...)` for baseline/replay/proposal/comparison/workflow persistence, but the route currently advances the workflow before calling the bundle method; this must be tightened so the workflow update is inside the same transaction.

### Trace and redacted sharing

- Retrieval traces expose policy outcome, freshness, exclusions, and graph-hop count.
- Trace sharing returns redacted metadata and hashed identifiers rather than query text, memory content, tenant IDs, or raw source data.

### Verification already run in this slice

- `npm run typecheck` passed after the correction transaction and envelope helper changes.
- Focused runtime tests passed:
  - `tests/runtime/repositories.test.ts`
  - `tests/runtime/developer-workflow.test.ts`
  - 11 tests total in the focused run.
- `git diff --check` passed (line-ending warnings only).

These results are `TESTED`, not browser or production proof.

## Known gaps and correctness warnings

1. **Evaluation is not yet compound-transactional.** The evaluate route still calls `saveEvaluationRun(...)` and then updates the workflow separately. Add an evaluation repository method that writes the evaluation run, evaluation event-ledger record, outbox record, and workflow update in one transaction.
2. **Replay transaction boundary is incomplete.** `app/api/v1/memory/replay/route.ts` calls `advanceWorkflowRun(...)` before `saveEvaluationBundleAtomic(...)`. Refactor so the final workflow record is part of the bundle transaction, with no best-effort pre-write.
3. **The shared envelope is unused or only partially used.** `lib/runtime/api-envelope.ts` defines `apiSuccess(...)` and `apiFailure(...)`, but critical routes still construct ad-hoc JSON. Adopt it consistently for correction, evaluate, replay, recall, trace, retain, and workflow responses without breaking clients.
4. **Workbench metadata is incomplete.** The page still relies on local trace state for some controls and does not consistently display server `traceId`, `eventId`, `revisionId`, replay comparison, evaluation metrics, retryability, and terminal failure state.
5. **Ingest/retain/recall are not fully canonical from the workbench.** Some actions still use the local sandbox engine. Keep any fixture explicitly labeled offline; do not let it silently substitute for canonical PostgreSQL behavior.
6. **Durable refresh is pending.** Reloading `/sandbox/developer` must read the persisted workflow run and restore its current step, completed steps, IDs, and failure state.
7. **Full validation has not been run for this latest boundary.** Full Vitest, migration validation, and Playwright acceptance remain pending.

## Required implementation roadmap

### Step 1 — Atomic correction hardening

Already started, but finish the contract and tests:

- Confirm `correctMemoryAtomic(...)` enforces scope and idempotency.
- Add rollback test proving no fact, evidence, revision, event, outbox, or workflow row survives a failed transaction.
- Add duplicate-request test proving the same idempotency key does not create a second revision/event.
- Verify correction response contains `requestId`, `workflowRunId`, revision ID, event ID, and explicit state.

### Step 2 — Atomic evaluation transaction

Add `saveEvaluationAtomic(...)` to:

- `lib/runtime/repositories/interfaces.ts`
- `lib/runtime/repositories/postgres.ts`
- `lib/runtime/repositories/test-double.ts`

The transaction must persist:

- evaluation run and metrics;
- an evaluation event-ledger record with correlation and idempotency key;
- outbox record if the existing event model requires it;
- workflow-run update to `evaluate` and its final status.

Use the existing event envelope/outbox helpers. Scope every insert by tenant, bank, project, and workflow run. Add success, rollback, and duplicate tests.

### Step 3 — Unified API envelope

Use `lib/runtime/api-envelope.ts` as the single response shape:

```ts
{
  ok,
  requestId,
  workflowRunId,
  state,
  data,
  trace,
  error?,
  retryable?
}
```

Ensure workflow responses preserve policy outcome, freshness, confidence, citations/evidence, exclusions, graph hops, latency, and token metadata when applicable. Never convert unavailable metrics to zero. Preserve HTTP status semantics for unauthorized, unavailable, degraded, empty, queued, and failed states.

### Step 4 — Server-result workbench

Update `app/sandbox/developer/page.tsx`:

- maintain server facts separately from local fixture trace state;
- use server recall results to enable correction;
- display workflow state, canonical-store status, request ID, workflow run ID, trace ID, event ID, revision ID, replay comparison, evaluation before/after metrics, retryable failures, and terminal failures;
- show explicit empty/degraded/unavailable/unauthorized states;
- keep offline fixture behavior visibly labeled and never use it to claim canonical success.

### Step 5 — Durable refresh and isolation

- On page load, fetch the workflow run by ID (or resume the last scoped run only through a server-authorized reference).
- Restore step state and server metadata after refresh.
- Verify server-side tenant/bank/project authorization on every read and mutation.
- Add unauthorized cross-project tests and stale/missing workflow tests.

### Step 6 — Browser acceptance gate

Run the real authenticated journey at 375px, 768px, and 1440px, plus keyboard-only and reduced-motion checks. Cover:

- successful complete workflow;
- empty retrieval;
- unavailable canonical store;
- degraded response;
- unauthorized project;
- replay failure;
- refresh/resume with the same durable workflow run;
- visible focus and serious/critical axe checks.

The test should assert user-visible outcomes, not internal module URLs.

### Step 7 — Evidence and handoff update

Update the current roadmap with separate labels for each result:

- `IMPLEMENTED`
- `TESTED`
- `LOCALLY VERIFIED`
- `BROWSER VERIFIED`
- `BENCHMARK VERIFIED`
- `PRODUCTION VERIFIED` (remain false unless actually proven)

Record exact commands, pass/fail counts, skipped prerequisites, and remaining authorization boundaries.

## Recommended command sequence for the next chat

```powershell
npm run typecheck
npm test -- --run tests/runtime/repositories.test.ts tests/runtime/developer-workflow.test.ts
npm test
npm run test:e2e
```

If PostgreSQL is configured, also run the project’s migration/staging validation commands from `AGENTS.md`. Do not report browser or local-runtime verification if prerequisites are unavailable.

## Explicitly out of scope

- production deployment or rollback;
- new live connectors or provider authorization;
- dashboard redesign and cross-worker observability aggregation;
- billing, multi-tenant administration, or background-worker redesign;
- changing provider configuration or exposing secrets.

## Exit gate for this slice

Do not call the slice complete until a browser can open `/sandbox/developer`, complete the full workflow, refresh, and still see the same server-backed workflow state and evidence trail. The proof must show one durable workflow run, one correlation ID, event records for every mutation, revision linkage, replay linkage, evaluation comparison, redacted trace sharing, honest failure states, and no silent local-success fallback.

## First action in the next chat

Read this handoff and `AGENTS.md`, inspect the dirty diff, then implement **Step 2 — atomic evaluation transaction** before changing the UI. Run focused repository tests immediately after that change.
