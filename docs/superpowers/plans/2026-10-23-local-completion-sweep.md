# Local Completion Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete deterministic A/B/C benchmark fixtures, repeated local concurrency-100 recall profiling, and available seeded browser coverage without making external or production claims.

**Architecture:** Extend the existing pure Tier-1.5 producer with explicit fixture metadata and measurable A/B/C assertions. Extend the read-only recall profiler with repeated-run aggregation rather than changing runtime scheduling. Seed only local test data through existing authenticated routes, then prove graph, review/replay, and export journeys in Playwright.

**Tech Stack:** TypeScript, Node.js, Vitest, PostgreSQL, Next.js, Playwright, axe-playwright.

**Spec:** `docs/superpowers/handoffs/2026-10-23-live-codex-capture-next-chat.md`

## Global Constraints

- PostgreSQL remains the canonical durable store.
- Preserve tenant, bank, project, conversation, agent, provenance, and idempotency scope.
- Keep default recall behavior unchanged unless measured evidence supports a safe change.
- Never claim local Docker, deterministic fixtures, or browser tests as production or non-Codex connector evidence.
- Preserve all pre-existing dirty worktree changes.

## Review Focus

- Same seed/timestamp must recreate identical fixture and replay hashes.
- Isolation controls must include three independently scoped projects and an explicit denied contamination attempt.
- Repeated profiling must retain every individual run so aggregation cannot hide an outlier or failure.
- Browser setup data must be uniquely scoped and must not depend on pre-existing review records.
- Browser assertions must fail closed when protected scope is absent.

### Task 1: Versioned Scenario A/B/C fixture contract

**Files:**
- Modify: `lib/runtime/tier15-benchmark.ts`
- Modify: `tests/runtime/tier15-benchmark.test.ts`
- Modify: `scripts/tier15-benchmark-report.mjs`

**Interfaces:**
- Produces a deterministic report containing Scenario A isolation, Scenario B long-context recall, Scenario C supersession timeline, pinned configuration metadata, and hashes.

- [ ] Write failing tests for three-project isolation, long-context precision/recall, supersession reconstruction, and pinned configuration metadata.
- [ ] Run the focused Vitest file and confirm the new assertions fail because fields/cases are missing.
- [ ] Add the smallest deterministic fixture/report fields required by those tests.
- [ ] Run the focused Vitest file and confirm it passes.
- [ ] Regenerate the deterministic report with a fixed seed and timestamp.

### Task 2: Repeated concurrency-100 profiler

**Files:**
- Modify: `scripts/postgres-recall-profile.mjs`
- Create: `scripts/postgres-recall-profile-repeat.mjs`
- Create: `tests/runtime/recall-profile-repeat.test.ts`

**Interfaces:**
- `summarizeRepeatedRecallProfiles(reports)` returns run count, failures, per-run p95 values, p50/p95/p99 of per-run p95, and a pass/fail SLO gate.

- [ ] Write a failing pure aggregation test covering a passing set, a failing outlier, and a failed HTTP request.
- [ ] Run the focused Vitest file and confirm it fails because the module is absent.
- [ ] Implement the pure summary function and small runner that invokes the existing profiler unchanged per run.
- [ ] Run focused tests and confirm they pass.
- [ ] Execute the unchanged local concurrency-100 workload repeatedly and save the individual and aggregate reports.

### Task 3: Seeded local browser completion paths

**Files:**
- Modify: `tests/e2e/typed-graph-journey.spec.ts`
- Modify or create: `tests/e2e/*review*.spec.ts`
- Modify or create: `tests/e2e/*export*.spec.ts`

**Interfaces:**
- Browser tests use unique local authenticated scope and assert graph temporal readback, review/replay mutation, and export visibility without fabrication.

- [ ] Add a failing browser test for each currently unseeded journey.
- [ ] Run the relevant Playwright projects and confirm failure demonstrates missing setup, not an unrelated runtime error.
- [ ] Add minimal authenticated route setup using unique scope and existing APIs.
- [ ] Run focused Playwright coverage, then the full E2E suite.

### Task 4: Evidence documentation and regression validation

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-23-live-codex-capture-next-chat.md`

- [ ] Record only directly observed results and label each as IMPLEMENTED, TESTED, LOCALLY VERIFIED, BROWSER VERIFIED, or BENCHMARK VERIFIED.
- [ ] Run `npm test`, `npm run typecheck`, relevant staging validation, and `git diff --check`.
- [ ] Inspect changed-file diff and preserve unresolved production/connector holds.
