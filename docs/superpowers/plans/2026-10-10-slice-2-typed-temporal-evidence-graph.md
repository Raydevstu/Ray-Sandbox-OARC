# Slice 2 Typed Temporal Evidence Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the bounded PostgreSQL-backed temporal graph foundation with deterministic entity resolution, evidence-complete edges, conflict states, and explainable two-hop retrieval.

**Architecture:** Keep PostgreSQL as the canonical scoped store and use a pure TypeScript graph service for deterministic normalization, conflict analysis, temporal filtering, and explanation trees. Graph entities, aliases, edges, edge evidence, and conflict review state remain append-only or upsert-safe within tenant/bank scope; traversal returns the complete selected path and every hop’s evidence.

**Tech Stack:** TypeScript, PostgreSQL migrations, existing `CanonicalRepository`/`TestRepository`, Vitest, existing auth/scope contracts.

**Spec:** `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`, Slice 2 requirements in the active handoff/roadmap.

## Global Constraints

- PostgreSQL remains canonical; no graph database is introduced.
- Every graph edge has source evidence and temporal metadata.
- Scope checks fail closed on tenant/bank mismatch.
- Historical evidence is preserved; contradictions become reviewable states.
- No deployment, provider credentials, connector authorization, cleanup, or commit.

## Review Focus

- Alias collisions must not resolve across tenant/bank scope; test deterministic tie-breaking and ambiguity.
- Open-ended and boundary timestamps must include only facts valid at the requested instant.
- Superseded and contradictory edges must remain queryable historically and be marked reviewable.
- Cycles and duplicate paths must terminate without leaking incomplete explanations.
- Missing edge evidence must be rejected before persistence.

### Task 1: Graph domain contracts and deterministic resolution

**Files:** Modify `lib/runtime/typed-graph.ts`; test `tests/runtime/typed-graph.test.ts`.

- [ ] Add failing tests for aliases, deterministic resolution, ambiguous aliases, conflict classification, supersession, and explanation-tree output.
- [ ] Run the focused graph test and confirm the expected missing-behavior failures.
- [ ] Implement typed entity/alias/edge/conflict contracts plus `resolveGraphEntity`, `detectGraphConflicts`, and bounded `traverseTypedGraph` with complete evidence-backed paths.
- [ ] Run the focused graph test until green.

### Task 2: Scoped durable graph schema and repository behavior

**Files:** Modify `db/migrations/0009_typed_graph.sql`, `db/schema.ts`, `lib/runtime/repositories/interfaces.ts`, `lib/runtime/repositories/test-double.ts`, `lib/runtime/repositories/postgres.ts`; test `tests/runtime/typed-graph-repository.test.ts` and `tests/runtime/migration.test.ts`.

- [ ] Add failing tests for aliases, edge evidence enforcement, temporal metadata, conflict state persistence, existing-data migration shape, and cross-scope rejection.
- [ ] Run the focused repository/migration tests and confirm failures.
- [ ] Add scoped alias and conflict tables/columns with foreign keys and indexes; expose repository save/list methods and reject empty evidence or invalid temporal ranges.
- [ ] Run focused repository/migration tests and the typecheck.

### Task 3: Temporal two-hop retrieval service

**Files:** Modify `lib/runtime/typed-graph.ts`; create `lib/runtime/typed-graph-service.ts`; test `tests/runtime/typed-graph.test.ts`.

- [ ] Add failing regressions for “before upgrade,” “as of date,” superseded facts, and contradictory facts becoming reviewable rather than silently ranked away.
- [ ] Implement a service that loads one scoped graph, resolves the start entity deterministically, applies the requested instant and relation filters, and returns selected paths plus explanation tree nodes.
- [ ] Run the focused temporal graph suite and full runtime tests.

### Task 4: Slice evidence and handoff update

**Files:** Modify `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`, `docs/superpowers/handoffs/2026-10-10-apex-control-plane-next-chat.md`.

- [ ] Record exact commands, migration result, focused/full test counts, and evidence limitations.
- [ ] Run `npm test`, `npm run typecheck`, and `git diff --check`; report Slice 2 status without claiming browser/live connector/production proof unless directly exercised.

