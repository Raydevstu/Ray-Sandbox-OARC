# Tier-1 Slices 1-5 Local Audit and Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit Slices 1 through 5 against the canonical Apex blueprint and close every locally completable gap without mislabeling provider, live-connector, or production evidence.

**Architecture:** PostgreSQL remains the canonical store. Local completion uses the existing repository, event-ledger, graph, evaluation/replay, API, and operator boundaries. External provider quality, authorized live connectors, paid deployment, rollback/RPO/RTO, and production evidence remain separate release gates.

**Tech Stack:** TypeScript, Next.js App Router, Zod, Vitest, Playwright/axe, PostgreSQL, Docker staging.

**Spec:** `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md` and the supplied baseline at `C:\Users\kafsh\.codex\attachments\95261232-eeef-4928-8c73-6e3f26c25e70\pasted-text.txt`.

## Status summary as of 2026-10-10

| Slice | Current classification | Evidence-backed reason | Remaining disposition |
|---|---|---|---|
| 1 — Enterprise Evidence Integrity Baseline | **PENDING — can complete locally** | SLO workload, provenance/event audits, dead-letter replay, focused/full tests, and local browser evidence exist. | Harden atomic retain writes, add broader tenant-isolation coverage, seed reviewable browser data, add export route, and rerun local staging/browser gates. |
| 2 — Typed Temporal Evidence Graph | **IMPLEMENTED / TESTED / LOCALLY VERIFIED; pending browser completion** | Typed graph, aliases, temporal filtering, conflicts, evidence-backed edges, two-hop explanations, route, migration, and regressions are present; full suite/typecheck/local staging passed. | Add a dedicated authenticated graph browser journey and retain explicit temporal/conflict evidence. No paid deployment is needed for this local gate. |
| 3 — Provider Extraction and Human Approval | **IMPLEMENTED / TESTED; pending manual/provider evidence** | Strict proposal schema, budgets, timeout handling, deterministic fallback, redacted telemetry, and policy approval routing are implemented and tested. | Run an authorized provider sample and human-reviewed corpus measurement. This requires manual provider authorization and may require an online/paid provider; keep it marked held until authorized. |
| 4 — Closed-Loop Evaluation and Replay | **COMPLETE for local deterministic scope; TESTED / LOCALLY VERIFIED** | 512-case versioned report, durable PostgreSQL artifacts, eleven failure classes, correction proposals, source-run checks, idempotency, missing-trace checks, and regression refusal are recorded and replayed. | Provider/human-reviewed quality, approval UI, live connector, and production evidence remain separate release-governance holds; they do not invalidate local replay completion. |
| 5 — Developer API and Operator UX | **PENDING — can complete locally** | SDK and six-route developer boundary exist; operator shell is keyboard/focus/reduced-motion/axe tested at 375/768/1440. | Wire operator subsections to authenticated durable data, enforce project filtering in trace, cover all seven operational states per major route, run PostgreSQL workflow integration, and complete the browser diagnosis journey. |

## Audit refinement: pending work by slice

This section separates unfinished local implementation from evidence that requires a user-held external dependency.

| Slice | Confirmed current position | Can complete locally now | Manual / external hold |
|---|---|---|---|
| 1 | Local audits, workload, dead-letter replay, and partial browser evidence exist. The measured workload was serialized because concurrent retain exposed a non-atomic repository path. | Make retain plus evidence, outbox, and ledger writes one transaction; add same-bank cross-project and cross-tenant corpus tests; seed a reviewable record; implement/export and authorize it; rerun staging and browser checks. | External deployment, deployed-target restore/RPO/RTO, and production retention policy evidence remain out of scope. |
| 2 | Domain, migration, route, temporal filters, conflict states, and two-hop explanations are implemented and tested. The existing browser coverage reaches the API but is not a dedicated graph diagnosis journey. | Add an authenticated graph journey proving as-of, before-upgrade, superseded, contradiction, aliases, and complete two-hop explanation; capture responsive, keyboard, reduced-motion, and axe evidence. | No paid dependency is required for this local gate. |
| 3 | Provider-neutral proposal validation, budgets, timeouts, deterministic fallback, redacted telemetry, and approval routing are implemented/tested. | Add deterministic approval-queue/API/browser fixtures and prove malformed, rejected, sensitive, ambiguous, timeout, and budget-exceeded proposals cannot persist canonical records. | Authorized provider execution and human-reviewed quality measurement require user authorization and may require paid/online provider access. |
| 4 | 512-case corpus, durable metrics, eleven failure fixtures, correction proposals, workflow replay, idempotency, scope checks, missing-trace checks, regression refusal, and PostgreSQL readback are locally complete. | Expose approval/replay artifacts in the operator workspace and add authenticated browser readback/action evidence; keep replay report hashes and counts in the final audit. | Provider/human quality, live connector, and production evidence remain separate release gates. |
| 5 | Developer SDK boundary and operator navigation shell are implemented/tested; shell-only browser coverage passes. | Enforce project filtering in trace; run the full SDK workflow against PostgreSQL; wire conflicts/policies/events/exports to authenticated durable handlers; cover empty, queued, healthy, degraded, unavailable, failed, unauthorized for each major route; complete the diagnosis journey. | No paid dependency is required for local completion. |

### Direct verification snapshot

- `npm test`: 65 test files passed, 1 skipped; 212 tests passed, 5 skipped.
- `npm run typecheck`: passed.
- `git diff --check`: passed with existing line-ending warnings only.
- Current checkpoint: `0d24489 chore: checkpoint slices 1-5 local implementation`.
- Current uncommitted paths are cache/test-result folders only: `.firecrawl/` and `test-results/`.
- The census helper was not available at the documented path in this Windows checkout; no census-derived claim is made here.

## Evidence boundary

The local plan may claim `IMPLEMENTED`, `TESTED`, `LOCALLY VERIFIED`, and `BROWSER VERIFIED` only after direct checks. It must not claim `BENCHMARK VERIFIED` for provider quality from a deterministic judge alone, `LIVE CONNECTOR VERIFIED` from a shared contract, or `PRODUCTION VERIFIED` from Docker staging. External deployment, managed credentials, rollback/RPO/RTO, and non-Codex connector authorization remain frozen unless explicitly authorized.

## Review focus

- Concurrent retain persistence must be atomic and retry-safe; test simultaneous writes with foreign-key and duplicate protection.
- Every trace query must enforce project scope, not merely echo `projectId`; test same-bank cross-project isolation.
- Operator sections must distinguish empty, queued, healthy, degraded, unavailable, failed, and unauthorized from one another; test each state through authenticated route data.
- Browser evidence must exercise a real authenticated journey from developer action to operator diagnosis; a static shell is insufficient.
- Provider quality must remain a separately labeled measurement; test that provider output cannot bypass policy, review, or canonical persistence.

### Task 1: Close Slice 1 local integrity gaps

**Files:**
- Modify: `lib/runtime/repositories/postgres.ts` and its repository interface as needed for one transaction covering retain, evidence links, outbox, and ledger event.
- Test: `tests/runtime/repositories.test.ts`, `tests/runtime/postgres-project-memory.integration.test.ts`, and a focused isolation test.
- Modify: `app/api/project-memory/export/` or the established export boundary.
- Test: authenticated export browser/API coverage under `tests/e2e/`.

- [ ] Write failing concurrent-retain, duplicate-safe, cross-tenant, review-seed, and export tests.
- [ ] Implement the smallest transaction and export changes behind existing repository/API boundaries.
- [ ] Run focused tests, `npm run staging:validate`, `npm run quality:slo:workload`, and `npm run quality:audit:postgres`.
- [ ] Run the authenticated browser journey with a deterministic reviewable fixture at 768px and verify export access control.
- [ ] Do not upgrade Slice 1 beyond `LOCALLY VERIFIED / BROWSER VERIFIED` until concurrent retain and export evidence are directly rerun.

### Task 2: Finish Slice 2 browser evidence

**Files:**
- Test: `tests/e2e/graph-journey.spec.ts`.
- Modify: existing graph/evidence UI only where the journey exposes a defect.

- [ ] Add authenticated as-of, superseded, contradiction, and two-hop explanation assertions.
- [ ] Verify 375/768/1440 layouts, keyboard focus, reduced motion, and serious/critical axe results.
- [ ] Run the focused graph journey and then `npm run test:e2e`.
- [ ] Preserve the graph explanation tree and temporal/conflict assertions as named artifacts in the handoff.

### Task 3: Measure Slice 3 with authorized provider and human review

**Files:**
- Use: `lib/runtime/memory-extraction.ts`, provider contract tests, adversarial corpus manifest, and redacted telemetry outputs.
- Create: a versioned provider-quality report under `benchmarks/` only after authorized execution.

- [ ] Obtain explicit provider authorization and safe test configuration; never commit credentials.
- [ ] Run provider extraction against the versioned adversarial corpus and a human-reviewed sample.
- [ ] Persist precision, rejection rate, latency, tokens, cost, confidence routing, and review outcomes.
- [ ] Prove malformed, rejected, timeout, budget-exceeded, sensitive, and ambiguous results cannot become canonical records.
- [ ] Mark provider evidence as pending if authorization or paid access is unavailable.

Local preparation before authorization:

- [ ] Add a deterministic approval-queue fixture and authenticated route test for `allow`, `deny`, `redact`, `require_review`, and `defer`.
- [ ] Add browser evidence that a rejected or malformed proposal is visible as a reviewable state and cannot create a canonical memory.

### Task 4: Preserve Slice 4 local completion and add operator approval evidence

**Files:**
- Modify: `app/sandbox/operator/` and existing review/policy routes.
- Test: focused operator approval and replay readback tests plus `tests/e2e/` coverage.

- [ ] Expose durable correction proposals and replay comparisons through authenticated operator reads.
- [ ] Add approve/reject/replay actions with scope, idempotency, event-ledger, and audit assertions.
- [ ] Re-run `npm run quality:slice4:report` and `npm run quality:slice4:replay`; preserve report hashes and PostgreSQL readback counts.
- [ ] Keep Slice 4 marked locally complete while separately tracking the approval UI and browser evidence as governance work.

### Task 5: Complete Slice 5 developer workflow

**Files:**
- Modify: `app/api/v1/memory/trace/route.ts` and the canonical fact/repository scope path.
- Test: `tests/runtime/developer-api-route.test.ts`, `tests/runtime/postgres-project-memory.integration.test.ts`, and `tests/e2e/developer-workflow.spec.ts`.

- [ ] Write a failing same-bank cross-project trace-isolation test.
- [ ] Enforce project scope in trace retrieval or make the contract explicitly correlation-only; the implementation must not imply filtering it does not perform.
- [ ] Exercise `retain → recall → trace → correct → replay → evaluate` against local PostgreSQL, including unavailable, unauthorized, malformed, duplicate, and regression paths.
- [ ] Verify correction creates revision, event, outbox, and replay-readable evidence.
- [ ] Verify a same-bank record from another project is absent from trace results; returning `projectId` in the envelope is not sufficient.

### Task 6: Complete Slice 5 operator workspace

**Files:**
- Modify: `components/operator/OperatorWorkspace.tsx` and `app/sandbox/operator/[section]/page.tsx`.
- Add or reuse: authenticated operator data handlers for conflicts, policies, events, and exports.
- Test: `tests/e2e/operator-workspace.spec.ts` and focused route/state tests.

- [ ] Replace placeholder subsections with authenticated durable reads while preserving explicit unavailable/degraded states.
- [ ] Cover all seven required states on every major route with stable test fixtures.
- [ ] Add the diagnosis journey: selected memory → evidence → graph path → policy/conflict → event/replay outcome.
- [ ] Re-run browser checks at 375/768/1440 with keyboard, visible focus, reduced motion, and axe validation.
- [ ] Record one authenticated diagnosis path from selected memory through evidence, graph/conflict/policy state, event, and replay outcome.

### Task 7: Final local release audit

- [ ] Run `npm test`, `npm run typecheck`, `npm run test:e2e`, `npm run staging:validate`, `npm run quality:audit:postgres`, `npm run quality:slo:workload`, `npm run quality:slice4:report`, and `npm run quality:slice4:replay`.
- [ ] Inspect migration status, dirty-worktree boundaries, report hashes, PostgreSQL readback, and `git diff --check`.
- [ ] Update the roadmap and handoff with dated evidence totals, skipped tests, remaining manual-assist items, and explicit online/paid holds.
- [ ] Do not mark the overall platform production-ready until authorized provider, connector, deployment, rollback/RPO/RTO, and production evidence exists.

## Recommended execution order for the next chat

1. Task 1 — Slice 1 atomic integrity and export.
2. Task 5 — Slice 5 project-scoped trace and PostgreSQL developer workflow.
3. Task 6 — Slice 5 durable operator workspace and seven-state coverage.
4. Task 2 — Slice 2 dedicated graph browser journey.
5. Task 4 — Slice 4 operator approval and replay readback evidence.
6. Local preparation in Task 3, then pause for explicit provider/human-review authorization.
7. Task 7 — final local audit and evidence-matrix update.

## Exit decision

The next slice is not blocked by paid deployment. Slice 5 can proceed to local completion now. Slice 3’s provider-quality gate and the release-governance portions of all slices remain held for explicit manual authorization and, if selected, online/paid infrastructure. The single recommended execution order is Tasks 1, 5, 6, 2, 4, then the authorized Task 3 measurement, followed by Task 7.
