# Memory App Scenario Benchmark

Generated: 2026-10-06T12:54:16.575Z

## Before / after

Pass rate: **100%** · Evaluation accuracy: **92.9% → 92.9%**

| Feature | Before | After | Delta | Status | Evidence |
|---|---:|---:|---:|---|---|
| Retain and metadata | 0 | 1 | +1 | PASS | 1 fact(s), temporal metadata and user scope present |
| Temporal intent and trace | 0 | 1 | +1 | PASS | current / historical |
| Cited deterministic digest | 0 | 1 | +1 | PASS | 8 bullets with source citations |
| L0/L1/L2 packing | 0 | 1 | +1 | PASS | 4 layers / 114 tokens |
| Current/history resolution | 0 | 1 | +1 | PASS | 1 current fact(s) |
| Canonical event and offline replay | 0 | 1 | +1 | PASS | 1 delivered, 0 pending |
| Outcome feedback | 0 | 1 | +1 | PASS | 1 immutable record |
| Filesystem projection | 0 | 1 | +1 | PASS | 19 generated files |

## Competitor/reference comparison

| System | Accuracy | Method note |
|---|---:|---|
| Hindsight sandbox (after) | 92.9% | Deterministic local gold-token judge |
| Hindsight sandbox (legacy baseline) | 92.9% | Same fixture; rerank/temporal/entity boosts disabled |
| Mem0 published reference | 92% | Reference only; not run in this local harness |
| Zep published reference | 81% | Reference only; not run in this local harness |

> Local results use a deterministic token-overlap judge. Published references are directional and were not executed by this harness.

## Audit

Major upgrade opportunities: add browser-level assertions for every control, replace synthetic competitor references with reproducible public datasets, add human/LLM judging beside token overlap, and add retry/restore controls for failed offline queue entries.

