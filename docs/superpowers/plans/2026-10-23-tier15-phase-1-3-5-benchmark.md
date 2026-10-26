# Tier-1.5 Phase 1/3/5 Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, versioned local benchmark harness for namespace isolation, temporal lineage, and adversarial boundary behavior.

**Architecture:** Add a pure TypeScript benchmark producer beside the existing evaluation contracts. It will generate stable corpus/config hashes, run positive and negative controls, calculate leakage/accuracy/latency/grounding metrics, and emit evidence labels without claiming provider or production behavior. A small Node script will write a JSON report for repeatable local inspection.

**Tech Stack:** TypeScript, Vitest, Node.js `crypto`, existing `EvaluationManifest` conventions.

**Spec:** User-provided Tier-1.5 Advanced AI Memory & Multi-Project Stress-Test Suite v2.0, limited to Phases 1, 3, and 5.

## Global Constraints

- Deterministic seed, timestamps, corpus IDs, configuration hash, and replay hash.
- Tenant, bank, project, conversation, and agent scope must be explicit in every case.
- Positive and negative controls are required for each phase.
- Synthetic local benchmark evidence must remain separate from live connector and production evidence.
- No secrets, credentials, or realistic secret values in fixtures or reports.
- Preserve unrelated dirty worktree changes and do not commit.

## Review Focus

- Cross-project queries must not pass by matching vocabulary alone; test exact scope rejection.
- Temporal answers must preserve order and active/deprecated state; test same-timestamp and conflicting updates.
- Injection text must remain untrusted content; test that it cannot become an authorization or policy mutation.
- Hashes must change when corpus/config changes but remain stable for the same seed and timestamp.
- Metrics must not report perfect quality when a negative control fails; test failure accounting explicitly.

### Task 1: Benchmark contract and deterministic producer

**Files:**
- Create: `lib/runtime/tier15-benchmark.ts`
- Test: `tests/runtime/tier15-benchmark.test.ts`

**Interfaces:**
- Produces `buildTier15Corpus()`, `produceTier15Benchmark(options)`, and `tier15Report(run)`.
- Returns phase cases, manifest/config hashes, per-case results, metrics, and evidence labels.

- [ ] Write failing tests for stable hashes, scope isolation, temporal ordering, injection rejection, and phase evidence labels.
- [ ] Run the focused test and confirm it fails because the producer does not exist.
- [ ] Implement deterministic corpus generation and pure phase evaluators with no external provider calls.
- [ ] Run the focused test and confirm it passes.

### Task 2: Report script and package command

**Files:**
- Create: `scripts/tier15-benchmark-report.mjs`
- Modify: `package.json`
- Test: `tests/runtime/tier15-benchmark.test.ts`

**Interfaces:**
- Script accepts `TIER15_GENERATED_AT` and `TIER15_SEED`, writes `docs/benchmarks/tier15-phase-1-3-5-report.json`, and prints summary JSON.

- [ ] Add a failing test for report shape and replay hash stability.
- [ ] Run the focused test to verify the missing report contract.
- [ ] Add the script and `quality:tier15:report` command using the pure producer.
- [ ] Run the script twice with the same inputs and compare hashes.

### Task 3: Verification and evidence boundary

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Create: `docs/benchmarks/tier15-phase-1-3-5-report.json`

- [ ] Run focused tests, full Vitest, typecheck, and the benchmark script.
- [ ] Inspect the generated report and final diff.
- [ ] Record exact measurements as local deterministic benchmark evidence only.

