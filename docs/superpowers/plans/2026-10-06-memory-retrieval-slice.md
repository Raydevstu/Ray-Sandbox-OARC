# Memory Retrieval Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the Hindsight Sandbox Memory app with measurable baseline evaluation, structured temporal retrieval, supersession-aware current/history behavior, layered memory summaries, and deterministic cited digests.

**Architecture:** Preserve the browser-only deterministic architecture. Add explicit temporal and layer metadata to facts, keep retrieval pure, and insert a deterministic digest stage after selection. Preserve backward compatibility through migrations/defaults and expose every new stage in the existing recall trace.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, npm, existing deterministic NLP/evaluation utilities.

**Spec:** User-requested implementation slice and Milestones 1-2 in the task message.

## Global Constraints

- Keep changes focused and below the project's 800-line change guidance where practical.
- Preserve existing localStorage state through defensive defaults/migrations.
- Do not introduce an LLM or network dependency; summaries and digests are deterministic.
- Preserve provenance: every digest bullet must cite one or more fact IDs.
- Do not silently discard superseded evidence; current/history is an explicit retrieval policy.

## Review Focus

- Facts without new metadata must remain recallable after hydration.
- Temporal queries must distinguish event time from mention time.
- Current queries must prefer non-superseded facts while historical queries retain evidence.
- Digest abstention must not fabricate a citation or silently inject weak matches.
- Layered packing must never exceed the configured token budget.

### Task 1: Baseline fixtures and temporal model

**Files:** Modify `lib/types.ts`, `lib/data/evalset.ts`; create `lib/engine/__tests__/temporal.test.ts`.

- [ ] Add failing tests for temporal metadata defaults and temporal evaluation fixtures.
- [ ] Add `TemporalMemoryType`, `TemporalStatus`, `TemporalMetadata`, and eval groups for abstention/scope/token efficiency.
- [ ] Verify focused tests.

### Task 2: Temporal extraction and query intent

**Files:** Modify `lib/engine/nlp.ts`, `lib/engine/retain.ts`, `lib/engine/recall.ts`; create `lib/engine/temporal.ts` and tests.

- [ ] Test event/state/plan classification and temporal query intent.
- [ ] Implement deterministic metadata extraction and intent-aware temporal scoring.
- [ ] Verify focused tests and existing evaluation.

### Task 3: Supersession-aware resolution and recall trace

**Files:** Modify `lib/engine/recall.ts`, `lib/types.ts`, `lib/engine/reflect.ts`, `components/memory/RecallTrace.tsx`, `app/sandbox/memory/page.tsx`; create tests.

- [ ] Test current/history/all-evidence policies and trace serialization.
- [ ] Implement policy-aware filtering/ranking and visible temporal/supersession stages.
- [ ] Verify focused tests and browser smoke path.

### Task 4: L0/L1/L2 summaries and layered packing

**Files:** Create `lib/engine/layers.ts`; modify `lib/engine/retain.ts`, `lib/engine/recall.ts`, `lib/types.ts`, `lib/store.ts`; create tests.

- [ ] Test deterministic layer generation, fallback for legacy facts, and budget-safe packing.
- [ ] Implement abstract/overview/detail layers and per-layer token accounting.
- [ ] Verify focused tests and evaluation regression.

### Task 5: Deterministic cited digest and UI controls

**Files:** Create `lib/engine/digest.ts`; modify `lib/types.ts`, `lib/engine/reflect.ts`, `app/sandbox/memory/page.tsx`, `app/sandbox/context/page.tsx`; create tests.

- [ ] Test cited bullet generation, duplicate compression, and abstention.
- [ ] Implement digest stage with off/deterministic modes and source fact IDs.
- [ ] Verify typecheck, lint, focused tests, and browser smoke test.

