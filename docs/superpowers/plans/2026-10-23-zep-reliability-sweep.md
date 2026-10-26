# Zep Reliability Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reproducible, bounded evidence for Zep duplicate, retry, timeout, concurrency, and recovery behavior using synthetic isolated users and threads.

**Architecture:** Extend the Zep adapter with a bounded timeout and safe-read retry policy. Keep mutating requests non-retried because the provider does not expose an idempotency contract in this adapter. A dedicated benchmark script will perform isolated live probes and prove cleanup by readback.

**Tech Stack:** TypeScript, Vitest, Node.js, Zep v4 HTTP API.

**Spec:** `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`

## Global Constraints

- Use only synthetic benchmark content and isolated disposable Zep users/threads.
- Never log or persist an API key, secret, or raw provider error body.
- Keep provider mutation retries disabled without an explicit idempotency contract.
- Poll deletion by readback before claiming cleanup.
- Label results `BENCHMARK VERIFIED` and `LIVE CONNECTOR VERIFIED` only after the live script completes.
- Do not claim `PRODUCTION VERIFIED`.

## Review Focus

- A transient safe-read failure retries once and succeeds without exposing the provider response body.
- A non-retryable client response fails immediately.
- A hanging provider request is aborted and classified as a timeout.
- Duplicate message submission is reported as observed provider behavior, not assumed idempotency.
- All users created by concurrent probes are independently absent after cleanup readback.

### Task 1: Bounded adapter transport policy

**Files:**
- Modify: `lib/runtime/zep-adapter.ts`
- Test: `tests/runtime/zep-adapter.test.ts`

**Interfaces:**
- Produces `createZepAdapter({ apiKey, timeoutMs?, safeReadRetries?, retryDelayMs?, fetchImpl? })`.
- Safe `GET` requests retry only transient transport and `5xx` failures; all writes remain single-attempt.

- [ ] **Step 1: Write failing adapter tests** for one transient `GET` retry, a `4xx` no-retry result, and a request that exceeds `timeoutMs`.
- [ ] **Step 2: Run focused tests and confirm each fails** because no bounded retry/timeout transport policy exists.
- [ ] **Step 3: Implement the minimum adapter transport policy** with per-request `AbortController`, sanitized errors, and safe-read-only retries.
- [ ] **Step 4: Run focused tests and confirm they pass.**

### Task 2: Live reliability benchmark

**Files:**
- Create: `scripts/zep-reliability-benchmark.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `docs/benchmarks/zep-reliability-benchmark.json` with duplicate, retry, timeout, concurrent isolation, recovery, and cleanup outcomes.

- [ ] **Step 1: Write a failing test or contract assertion** for the report schema and expected evidence fields.
- [ ] **Step 2: Run it and confirm it fails** because no reliability report is produced.
- [ ] **Step 3: Implement a bounded synthetic probe**: duplicate one message write, run safe-read retry and timeout controls, run five isolated cases concurrently, verify delete readback, and record observed outcomes.
- [ ] **Step 4: Run the report contract test and confirm it passes.**

### Task 3: Live execution, verification, and evidence update

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-23-live-codex-capture-next-chat.md`

- [ ] **Step 1: Run the live reliability command with the local secret environment.**
- [ ] **Step 2: Verify all temporary users return `404` after deletion and inspect the generated report.**
- [ ] **Step 3: Run focused tests, typecheck, full test suite, and `git diff --check`.**
- [ ] **Step 4: Update roadmap and handoff with exact measurements, report path, and remaining authorization-bound work.**
