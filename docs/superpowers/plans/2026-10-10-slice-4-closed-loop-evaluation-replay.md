# Slice 4 Closed-Loop Evaluation and Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a durable, versioned evaluation and replay contract that records corpus/config hashes, traces, per-case outcomes, quality/cost metrics, and before/after replay deltas.

**Architecture:** Keep PostgreSQL canonical and store the complete manifest, configuration metadata, traces, results, and aggregate metrics as validated JSONB payloads behind the existing repository interface. Use pure deterministic TypeScript functions for validation, aggregation, failure classification, correction proposals, and replay comparison so the same result can be reproduced locally and persisted without provider or connector access.

**Tech Stack:** TypeScript, Vitest, PostgreSQL migrations, existing `CanonicalRepository` adapters.

**Spec:** `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`

## Global Constraints

- PostgreSQL remains the canonical durable evaluation store.
- Every evaluation run is scoped and carries a versioned corpus/config identity plus hashes.
- No provider, connector, deployment, credential, or destructive cleanup work is included.
- Improvement claims use absolute metrics and before/after deltas.
- Existing benchmark contracts and routes remain backward-compatible.

## Review Focus

- Missing or mismatched corpus/config hashes must reject a run rather than create an unreproducible record.
- Non-finite, negative, or out-of-range metrics must reject persistence.
- A replay with a regression in grounding, citation precision, unsupported claims, graph accuracy, latency, queue delay, tokens, or cost must be marked as not improved.
- Scope mismatch must not expose or compare another tenant/bank's run.
- Failure and correction records must preserve the original case and trace references.

### Task 1: Versioned evaluation contract and metric engine

**Files:**
- Create: `lib/runtime/evaluation-contract.ts`
- Test: `tests/runtime/evaluation-contract.test.ts`

**Interfaces:**
- Produces `EvaluationManifest`, `EvaluationCaseResult`, `EvaluationMetrics`, `EvaluationRun`, `ReplayComparison`, `validateEvaluationRun`, `aggregateEvaluationMetrics`, `classifyEvaluationFailure`, and `compareEvaluationRuns`.

- [ ] Write failing tests for validation, absolute metrics, failure classification, and replay regression detection.
- [ ] Run focused tests and observe the missing-contract failure.
- [ ] Implement the minimal typed schemas and deterministic metric/replay functions.
- [ ] Run focused tests and then the full test suite.

### Task 2: Durable PostgreSQL evaluation storage

**Files:**
- Create: `db/migrations/0010_evaluation_replay.sql`
- Modify: `lib/runtime/repositories/interfaces.ts`
- Modify: `lib/runtime/repositories/test-double.ts`
- Modify: `lib/runtime/repositories/postgres.ts`
- Test: `tests/runtime/evaluation-repository.test.ts`
- Modify: `tests/runtime/migration.test.ts`

**Interfaces:**
- Consumes `EvaluationRun` and `ReplayComparison` from Task 1.
- Produces `saveEvaluationRun`, `listEvaluationRuns`, and `saveReplayComparison` repository methods.

- [ ] Write failing repository and migration contract tests for scoped idempotent run/replay persistence.
- [ ] Run focused tests and observe missing methods/tables.
- [ ] Add additive migration tables and adapter implementations with scope checks and JSONB payloads.
- [ ] Run focused repository/migration tests and the full suite.

### Task 3: Roadmap and handoff evidence

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-10-apex-control-plane-next-chat.md`

- [ ] Record Slice 4 implementation/test evidence and explicitly retain pending benchmark, browser, live connector, and production gates.
- [ ] Run typecheck and final verification commands; inspect the diff and migration order.

