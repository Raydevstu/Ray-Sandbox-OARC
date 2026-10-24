# Phase 3 Domain Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Context Tuning, Evaluation, Continuous Learning, and Orchestrator use scoped durable PostgreSQL domain records with refresh-safe UI flows.

**Architecture:** Extend the existing `CanonicalRepository`, PostgreSQL adapter, test double, and `/api/v1` envelope conventions. Keep browser state as a projection only; every runtime save/read is authenticated, scope-checked, and backed by PostgreSQL.

**Tech Stack:** Next.js App Router, TypeScript, Zod, PostgreSQL, Vitest, Playwright.

**Spec:** `docs/superpowers/handoffs/2026-10-23-phase-3-domain-persistence-next-chat.md`

## Global Constraints

- PostgreSQL remains the canonical durable store.
- Every domain object is tenant/bank/project scoped.
- Invalid, unavailable, unauthorized, and queued states remain explicit.
- Preserve unrelated dirty worktree changes and do not commit.

## Review Focus

- Scope mismatch must reject reads and writes.
- Refresh must hydrate the last durable object.
- Invalid JSON/settings must not persist.
- Store unavailability must not look like an empty success.
- Repeated saves must be idempotent.

### Task 1: ContextConfig persistence

Add the migration, repository methods, scoped GET/POST route, and context-page hydration/save; start with a failing test and verify test-double and PostgreSQL SQL contracts.

### Task 2: Evaluation durable UI flow

Hydrate canonical evaluation history, call canonical evaluate/replay routes in Runtime mode, and render explicit operation states with browser assertions.

### Task 3: Learning episode persistence

Add scoped episode records, repository/API methods, and refresh-safe learning UI persistence with redacted trace metadata.

### Task 4: Orchestrator persistence

Persist scoped graph/configuration and execution state, add read-after-refresh, and cover retry/failure status.

### Task 5: Evidence validation

Run focused tests, full Vitest, typecheck, staging build, canonical staging browser tests, and report evidence labels and gaps.
