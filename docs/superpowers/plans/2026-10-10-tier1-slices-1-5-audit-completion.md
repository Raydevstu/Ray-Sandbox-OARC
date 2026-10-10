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

### Task 2: Finish Slice 2 browser evidence

**Files:**
- Test: `tests/e2e/graph-journey.spec.ts`.
- Modify: existing graph/evidence UI only where the journey exposes a defect.

- [ ] Add authenticated as-of, superseded, contradiction, and two-hop explanation assertions.
- [ ] Verify 375/768/1440 layouts, keyboard focus, reduced motion, and serious/critical axe results.
- [ ] Run the focused graph journey and then `npm run test:e2e`.

### Task 3: Measure Slice 3 with authorized provider and human review

**Files:**
- Use: `lib/runtime/memory-extraction.ts`, provider contract tests, adversarial corpus manifest, and redacted telemetry outputs.
- Create: a versioned provider-quality report under `benchmarks/` only after authorized execution.

- [ ] Obtain explicit provider authorization and safe test configuration; never commit credentials.
- [ ] Run provider extraction against the versioned adversarial corpus and a human-reviewed sample.
- [ ] Persist precision, rejection rate, latency, tokens, cost, confidence routing, and review outcomes.
- [ ] Prove malformed, rejected, timeout, budget-exceeded, sensitive, and ambiguous results cannot become canonical records.
- [ ] Mark provider evidence as pending if authorization or paid access is unavailable.

### Task 4: Preserve Slice 4 local completion and add operator approval evidence

**Files:**
- Modify: `app/sandbox/operator/` and existing review/policy routes.
- Test: focused operator approval and replay readback tests plus `tests/e2e/` coverage.

- [ ] Expose durable correction proposals and replay comparisons through authenticated operator reads.
- [ ] Add approve/reject/replay actions with scope, idempotency, event-ledger, and audit assertions.
- [ ] Re-run `npm run quality:slice4:report` and `npm run quality:slice4:replay`; preserve report hashes and PostgreSQL readback counts.

### Task 5: Complete Slice 5 developer workflow

**Files:**
- Modify: `app/api/v1/memory/trace/route.ts` and the canonical fact/repository scope path.
- Test: `tests/runtime/developer-api-route.test.ts`, `tests/runtime/postgres-project-memory.integration.test.ts`, and `tests/e2e/developer-workflow.spec.ts`.

- [ ] Write a failing same-bank cross-project trace-isolation test.
- [ ] Enforce project scope in trace retrieval or make the contract explicitly correlation-only; the implementation must not imply filtering it does not perform.
- [ ] Exercise `retain → recall → trace → correct → replay → evaluate` against local PostgreSQL, including unavailable, unauthorized, malformed, duplicate, and regression paths.
- [ ] Verify correction creates revision, event, outbox, and replay-readable evidence.

### Task 6: Complete Slice 5 operator workspace

**Files:**
- Modify: `components/operator/OperatorWorkspace.tsx` and `app/sandbox/operator/[section]/page.tsx`.
- Add or reuse: authenticated operator data handlers for conflicts, policies, events, and exports.
- Test: `tests/e2e/operator-workspace.spec.ts` and focused route/state tests.

- [ ] Replace placeholder subsections with authenticated durable reads while preserving explicit unavailable/degraded states.
- [ ] Cover all seven required states on every major route with stable test fixtures.
- [ ] Add the diagnosis journey: selected memory → evidence → graph path → policy/conflict → event/replay outcome.
- [ ] Re-run browser checks at 375/768/1440 with keyboard, visible focus, reduced motion, and axe validation.

### Task 7: Final local release audit

- [ ] Run `npm test`, `npm run typecheck`, `npm run test:e2e`, `npm run staging:validate`, `npm run quality:audit:postgres`, `npm run quality:slo:workload`, `npm run quality:slice4:report`, and `npm run quality:slice4:replay`.
- [ ] Inspect migration status, dirty-worktree boundaries, report hashes, PostgreSQL readback, and `git diff --check`.
- [ ] Update the roadmap and handoff with dated evidence totals, skipped tests, remaining manual-assist items, and explicit online/paid holds.
- [ ] Do not mark the overall platform production-ready until authorized provider, connector, deployment, rollback/RPO/RTO, and production evidence exists.

## Exit decision

The next slice is not blocked by paid deployment. Slice 5 can proceed to local completion now. Slice 3’s provider-quality gate and the release-governance portions of all slices remain held for explicit manual authorization and, if selected, online/paid infrastructure. The single recommended execution order is Tasks 1, 5, 6, 2, 4, then the authorized Task 3 measurement, followed by Task 7.
