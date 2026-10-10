# Slice 5 Developer API and Operator UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose a stable developer workflow over the governed runtime and establish the operator workspace boundary without requiring callers to understand PostgreSQL internals.

**Architecture:** Extend the existing typed SDK and App Router API around the canonical repository and existing retention, retrieval, review, evaluation, and replay contracts. Keep developer workflow routes under `/api/v1` and operator read surfaces under `/api/project-memory`; all writes remain authenticated, scoped, idempotent where applicable, and evidence-linked by existing services.

**Tech Stack:** TypeScript, Next.js App Router, Zod, Vitest, PostgreSQL repository interfaces, existing React/Tailwind operator shell.

**Spec:** `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md` (Slice 5)

## Global Constraints

- PostgreSQL remains the canonical durable store.
- Every derived memory and graph relationship remains evidence-linked.
- Every durable mutation remains event-ledgered.
- Scope failures remain fail-closed.
- Provider, external deployment, live non-Codex connector, and production claims remain out of scope.
- Preserve all existing dirty worktree changes.

## Review Focus

- A client must not be able to correct a memory outside its tenant or project scope; route tests cover `403` scope denial.
- Duplicate correct/replay/evaluate submissions must be retry-safe; tests cover stable idempotency behavior.
- Invalid or incomplete evaluation/replay payloads must not persist canonical records; route tests cover schema rejection.
- Trace responses must preserve evidence rationale and degrade explicitly when the canonical store is unavailable; route tests cover `503`.
- Existing MCP and project-memory routes must remain compatible; the full Vitest suite covers regression behavior.

### Task 1: Typed Developer Workflow API

**Files:**
- Modify: `lib/runtime/sdk/client.ts`
- Create: `app/api/v1/memory/[id]/route.ts`
- Create: `app/api/v1/memory/trace/route.ts`
- Create: `app/api/v1/memory/replay/route.ts`
- Create: `app/api/v1/memory/evaluate/route.ts`
- Test: `tests/runtime/sdk-client.test.ts`
- Test: `tests/runtime/developer-api-route.test.ts`

**Interfaces:**
- Consumes: existing `retainMemory`, `recallMemory`, `updateMemory`, `buildRetrievalTrace`, `EvaluationRun`, `EvaluationCorrectionProposal`, `WorkflowReplay`, and `CanonicalRepository` contracts.
- Produces: `MemoryApiClient.trace`, `.correct`, `.replay`, and `.evaluate` methods and stable route envelopes.

- [ ] Write failing SDK path/body tests for all six workflow operations.
- [ ] Run the focused SDK tests and observe failure because the methods/routes are absent.
- [ ] Implement the smallest typed client methods and authenticated route handlers; use stable request IDs and existing repository methods.
- [ ] Add route tests for unauthenticated, invalid, scope-denied, unavailable-store, valid, and idempotent cases.
- [ ] Run focused tests, typecheck, and the full Vitest suite.

### Task 2: Operator Workspace Boundary

**Files:**
- Modify: `components/shell/SandboxLayout.tsx`
- Create: `app/sandbox/operator/page.tsx`
- Create: `components/operator/OperatorWorkspace.tsx`
- Test: `tests/e2e/operator-workspace.spec.ts`

**Interfaces:**
- Consumes: existing health, audit, graph, policy, events, benchmark, and trace route contracts.
- Produces: a separate operator route with explicit navigation for health, evidence, graph, conflicts, policies, events, benchmarks, and exports.

- [ ] Write browser assertions for route navigation, keyboard focus, reduced-motion preference, and responsive 375/768/1440 rendering.
- [ ] Run the focused browser test to observe missing route/navigation failures.
- [ ] Implement the operator workspace shell and explicit empty/queued/healthy/degraded/unavailable/failed/unauthorized states using existing components.
- [ ] Run the focused browser/axe test and fix serious/critical violations only within the new surface.

### Task 3: Slice 5 Evidence Update

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-10-apex-control-plane-next-chat.md`

- [ ] Record exact implementation/test evidence and distinguish local from browser evidence.
- [ ] Run final typecheck, Vitest, focused Playwright/axe, and diff checks.
- [ ] Record remaining release-governance gaps; do not mark Slice 5 complete unless its exit gate is directly verified.
