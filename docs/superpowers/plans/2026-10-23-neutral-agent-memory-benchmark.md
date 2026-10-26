# Neutral Agent Memory Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a provider-neutral benchmark contract and local runner that can measure this app and future memory-system adapters under identical corpus and metric rules.

**Architecture:** Reuse the existing deterministic Tier-1.5 corpus and benchmark evidence model. Add a small adapter interface for ingest, recall, mutation, deletion, export, and health; keep external adapters capability-gated and never fabricate unavailable results. Persist only normalized, redacted benchmark results.

**Tech Stack:** TypeScript, Vitest, existing deterministic corpus/report utilities, Node benchmark scripts.

**Global Constraints**

- Local PostgreSQL remains the canonical store for the app baseline.
- External provider, connector, and production evidence require direct execution evidence.
- No credentials are read, printed, or committed.
- Results must distinguish IMPLEMENTED, TESTED, LOCALLY VERIFIED, BENCHMARK VERIFIED, LIVE CONNECTOR VERIFIED, and PRODUCTION VERIFIED.

**Review Focus**

- Scope leakage: cross-tenant and cross-project reads must be rejected.
- Unequal setup: every adapter receives the same corpus and query order.
- Missing capability: unsupported mutation/delete/export must be reported, not scored as success.
- Metric mixing: retrieval quality and model-answer quality must remain separate.
- Failure behavior: timeout, duplicate, retry, and recovery outcomes must be recorded.

### Task 1: Neutral adapter contract

**Files:** Create `lib/runtime/neutral-memory-benchmark.ts`; test `tests/runtime/neutral-memory-benchmark.test.ts`.

- [ ] Write failing tests for normalized adapter identity, capability reporting, deterministic case ordering, and unsupported-operation results.
- [ ] Run the focused test and confirm the expected missing-contract failure.
- [ ] Implement `NeutralMemoryAdapter`, `NeutralBenchmarkCase`, `NeutralBenchmarkResult`, and capability-safe operation helpers.
- [ ] Run focused tests, then the full unit suite.

### Task 2: Local adapter and runner

**Files:** Create `scripts/neutral-memory-benchmark.mjs`; modify `package.json`; test `tests/runtime/neutral-memory-benchmark.test.ts`.

- [ ] Add the local PostgreSQL adapter behind the neutral contract.
- [ ] Run the existing Tier-1.5 corpus through the adapter with fixed seed, timestamps, query order, and replay hash.
- [ ] Emit a redacted report containing quality, citation, unsupported-claim, leakage, latency, cost, and recovery fields with evidence labels.
- [ ] Verify the report locally and update the roadmap/handoff.

### Task 3: External adapter readiness

- [ ] Inspect available official SDK/API contracts for Mem0, Zep, Letta, and Hindsight without reading credentials.
- [ ] Add capability/readiness entries only where an equivalent adapter can be executed safely.
- [ ] Run live comparisons only when the required authorized endpoint and credentials are present.
- [ ] Mark unavailable systems `NOT RUN — AUTH/ADAPTER REQUIRED`, never zero or pass.

### Task 4: Repeated load and failure injection

- [ ] Reuse the unchanged concurrency-100 workload after the single-run baseline is stable.
- [ ] Add duplicate, retry, timeout, deletion, and recovery probes.
- [ ] Compare normalized results and publish only same-condition measurements.

