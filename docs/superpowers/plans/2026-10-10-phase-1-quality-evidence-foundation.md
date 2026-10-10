# Phase 1 Quality and Evidence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one tested vertical path from input through durable evidence, derived project memory, explainable retrieval, and adversarial evaluation.

**Architecture:** Extend the existing append-only `ProjectEvent` and `ProjectMemoryRecord` contracts. Add a deterministic retrieval trace that links selected records to evidence and selection rationale, then evaluate the trace against versioned adversarial cases. Keep PostgreSQL and the existing repository/worker interfaces as the durable boundary; use the test repository for unit-level execution.

**Tech Stack:** TypeScript, Next.js App Router, PostgreSQL, Vitest, existing repository and project-memory pipeline.

**Spec:** `docs/superpowers/PROJECT-CORE-HEART.md` and the attached Strategic Product Roadmap, Phase 1 quality/evidence requirements.

## Global Constraints

- Preserve tenant, bank, project, conversation, and provenance scope on every event and derived record.
- Preserve append-only source events; projection records remain replayable and deterministic.
- Keep provider extraction out of this slice; deterministic extraction is explicitly a baseline, not production-quality proof.
- Preserve SLA targets: retain p50 <50 ms, p95 <250 ms, p99 <500 ms; recall p50 <120 ms, p95 <500 ms, p99 <1200 ms.
- Do not claim the roadmap quality thresholds until the adversarial corpus has the required coverage and measured results.

## Review Focus

- A record with missing evidence must never be returned as verified; test retrieval rejection or degraded explanation.
- A query must not cross tenant, bank, or project scope; test all three boundaries.
- Superseded and conflicting records must produce deterministic selection rationale; test temporal ordering and ties.
- Duplicate source events must not create duplicate evidence or derived records; test replay idempotency.
- Evaluation output must identify corpus version, case IDs, thresholds, and failures without leaking raw secrets or transcript paths.

---

### Task 1: Retrieval trace and evidence graph contract

**Files:**
- Modify: `lib/runtime/contracts.ts`
- Create: `lib/runtime/retrieval-trace.ts`
- Test: `tests/runtime/retrieval-trace.test.ts`

**Interfaces:**
- Produce `RetrievalTrace`, `RetrievalTraceItem`, and `buildRetrievalTrace(records, query, traceId)`.
- Each trace item carries record ID, evidence references, score, rationale, confidence, and temporal metadata.

- [x] Write failing tests for scoped, evidence-backed selection, deterministic ordering, and missing-evidence degradation.
- [x] Run the focused test and confirm failure because the trace contract is absent.
- [x] Implement the minimal contract and deterministic lexical scoring adapter.
- [x] Run the focused test and confirm pass.

### Task 2: End-to-end pipeline result

**Files:**
- Create: `lib/runtime/quality-evidence-pipeline.ts`
- Test: `tests/runtime/quality-evidence-pipeline.test.ts`

**Interfaces:**
- Produce `runQualityEvidenceSlice(repository, input)` returning source event, evidence, derived record, retrieval trace, and evaluation result.
- Use existing `persistEvidenceEvent`, `extractProjectMemoryCandidates`, `ProjectMemoryPipeline`, and replay functions.

- [x] Write a failing end-to-end test asserting `input → durable event → evidence → derived memory → retrieval → explanation → evaluation result`.
- [x] Run it and confirm the missing pipeline failure at the trace/evaluation boundary.
- [x] Implement the smallest orchestration using existing repository contracts and no new persistence abstraction.
- [x] Add failure, duplicate, scope, and no-match coverage through the existing repository and pipeline contracts.
- [x] Run focused tests and confirm pass.

### Task 3: Versioned adversarial evaluation harness

**Files:**
- Create: `lib/runtime/adversarial-evaluation.ts`
- Create: `tests/fixtures/adversarial-memory-cases.ts`
- Test: `tests/runtime/adversarial-evaluation.test.ts`

**Interfaces:**
- Produce `AdversarialCase`, `AdversarialEvaluation`, and `evaluateRetrievalTrace(cases, traceByCase)`.
- Report corpus version, case count, precision, multi-hop accuracy, isolation failures, and failed case IDs.

- [x] Write failing tests for isolation and missing-result cases; retain temporal/multi-hop case types in the versioned evaluator contract.
- [x] Run and confirm failure.
- [x] Implement deterministic case evaluation with explicit limitations and no fabricated model-quality claims.
- [x] Run focused tests and confirm pass.

### Task 4: SLA and quality gate verification

**Files:**
- Modify: `tests/runtime/quality-evidence-pipeline.test.ts`
- Modify: `tests/runtime/adversarial-evaluation.test.ts`
- Modify: `docs/superpowers/PROJECT-CORE-HEART.md`

- [x] Add bounded local latency measurements for the vertical path and assert only the local test budget.
- [x] Add contract assertions for provenance, scope isolation, idempotency, and deterministic replay through the existing and new tests.
- [x] Run focused tests, full Vitest, typecheck, and `git diff --check`.
- [ ] Record implemented/tested status and leave production, provider, and benchmark claims explicitly pending where evidence is absent.

### Task 5: Final review

- [ ] Inspect the final diff and dirty-worktree preservation.
- [ ] Run the staging health check and the new vertical-path smoke test against `127.0.0.1:3028` if the existing runtime supports the contract without auth expansion.
- [ ] Report code, test, HTTP, browser, benchmark, and production evidence separately.
