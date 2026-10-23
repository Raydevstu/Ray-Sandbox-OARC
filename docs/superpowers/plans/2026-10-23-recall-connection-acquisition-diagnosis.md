# Recall Connection-Acquisition Diagnosis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate PostgreSQL client-acquisition, query execution, request assembly, and response serialization timing for the existing recall profile, then measure the unchanged concurrency-100 workload.

**Architecture:** Keep the existing PostgreSQL pool, scheduler, recall input, and full response projection unchanged. Replace the profiled read executor's `Pool.query` convenience call with equivalent `Pool.connect` → `Client.query` → `release` behavior only when profiling is enabled, so the already-existing request timing can expose acquisition and execution independently.

**Tech Stack:** Next.js route handlers, TypeScript, node-postgres, Vitest, local Docker PostgreSQL benchmark scripts.

**Spec:** `docs/superpowers/handoffs/2026-10-23-live-codex-capture-next-chat.md`

## Global Constraints

- Preserve the current PostgreSQL pool bounds, scheduler configuration, full recall response contract, and concurrency-100 workload.
- Emit only redacted durations and pool counters; do not log SQL parameters, prompts, or recall content.
- Treat the result as local benchmark evidence only; production, provider, and non-Codex connector evidence remain unclaimed.

## Review Focus

- A missing client release must be caught by the executor behavior test.
- Acquisition and execution must be separate timing stages, rather than a renamed combined `sql` duration.
- A disabled profiler must retain the existing standard pool-query path and emit no timing data.
- Multiple read queries must aggregate deterministically without exposing request data.
- The HTTP workload must remain concurrency 100, full projection, and unchanged pool settings.

### Task 1: Profiled PostgreSQL Read Executor

**Files:**
- Modify: `lib/runtime/recall-profiling.ts`
- Modify: `lib/runtime/repository.ts`
- Modify: `tests/runtime/recall-profiling.test.ts`

**Interfaces:**
- Produces `connection` and `query` recall timing stages for profiled reads.
- Keeps `createRuntimeRepository(scope, profiler?)` and unprofiled read behavior compatible.

- [x] **Step 1: Write failing tests** for separate connection/query timing and client release.
- [x] **Step 2: Run the focused test** and verify it fails because the timing stages/executor behavior are absent.
- [x] **Step 3: Implement the minimal profiled read executor** using `Pool.connect`, `Client.query`, and `release` in `finally`; preserve `Pool.query` when profiling is disabled.
- [x] **Step 4: Run focused profiling tests** and verify they pass.

### Task 2: Unchanged Workload Measurement and Evidence

**Files:**
- Modify: `scripts/postgres-recall-profile.mjs`
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-23-live-codex-capture-next-chat.md`

**Interfaces:**
- Extends the existing report with p50/p95/p99 values for redacted server timing stages.
- Produces one versioned concurrency-100 local benchmark report.

- [x] **Step 1: Write a failing report-shaping test** for stage aggregation if the script’s behavior is extracted; otherwise preserve the script as the direct integration measurement boundary.
- [x] **Step 2: Add per-stage aggregate fields** while preserving all existing workload parameters and result metrics.
- [x] **Step 3: Run the unchanged concurrency-100 profile** against the local Docker/PostgreSQL staging path.
- [x] **Step 4: Update roadmap and handoff** with exact measured values and evidence labels; do not claim an SLO pass unless every required result passes.
- [x] **Step 5: Run focused tests, typecheck, relevant staging validation, and diff checks.**

## Self-Review

The plan adds one diagnostic boundary and one benchmark evidence update. It deliberately does not alter pool size, request concurrency, SQL shape, response projection, external integrations, or deployment configuration.
