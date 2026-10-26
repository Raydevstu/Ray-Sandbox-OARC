# Slice 5 Diagnosis Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the authenticated, project-scoped PostgreSQL diagnosis workflow and make all seven operational states explicit in the developer and operator surfaces.

**Architecture:** Add a small shared route-state contract that classifies safe runtime outcomes without altering authorization or repository ownership. Exercise existing SDK routes in one persisted PostgreSQL workflow, then make the operator workspace render authenticated route data and state rather than static claims.

**Tech Stack:** Next.js route handlers, TypeScript, Zod, PostgreSQL, Vitest, Playwright, axe-playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-slice-5-diagnosis-workflow-design.md`

## Global Constraints

- PostgreSQL remains the canonical store; browser components do not query it directly.
- Every protected action fails closed on missing or mismatched tenant, bank, or project scope.
- Preserve evidence, revision, event-ledger, correlation, and idempotency behavior.
- Never expose credentials, raw provider payloads, or unredacted evidence in operational responses.
- Do not add connector credentials, provider configuration, external deployment, or production claims.
- Use two-space TypeScript indentation and semicolons.

## Review Focus

- A trace request for project B must not retrieve a fact retained for project A; Task 2 adds an isolation assertion.
- An unavailable canonical store must be distinguishable from an empty result; Task 1 and Task 3 add separate state and HTTP assertions.
- A mismatched authenticated tenant must be `unauthorized`, not `failed`; Task 3 adds a scope-denial route test.
- A replay whose proposal/source run does not match the project must not create durable artifacts; Task 2 adds a cross-project rejection assertion.
- Operator sections must not render staging scope as if it were authenticated user data; Task 4 adds route-driven, state-specific rendering tests.

---

### Task 1: Define the operational-state contract

**Files:**
- Create: `lib/runtime/operational-state.ts`
- Test: `tests/runtime/operational-state.test.ts`
- Modify: `lib/runtime/sdk/client.ts`

**Interfaces:**
- Produces: `OperationalState`, `OperationalEnvelope<T>`, and `classifyOperationalState(input)`.
- Consumes: HTTP status, safe error code, retryability, and optional result count.
- Produces for later tasks: a typed `state` field on SDK API envelopes.

- [ ] **Step 1: Write failing classifier and envelope tests**

Cover exact mappings: a non-empty successful durable result is `healthy`; a successful zero-result query is `empty`; accepted asynchronous work is `queued`; fallback is `degraded`; HTTP 503 is `unavailable`; a handled 4xx/5xx completion error is `failed`; HTTP 401/403 is `unauthorized`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/runtime/operational-state.test.ts`

Expected: FAIL because the state contract does not exist.

- [ ] **Step 3: Implement `OperationalState`, `OperationalEnvelope<T>`, and `classifyOperationalState`**

Keep classification pure and input-driven in `lib/runtime/operational-state.ts`; preserve the original safe error and request ID in the envelope.

- [ ] **Step 4: Extend `ApiEnvelope<T>` and transport normalization**

Add optional `state: OperationalState` to the SDK envelope without changing route paths or request bodies.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npx vitest run tests/runtime/operational-state.test.ts tests/runtime/sdk-client.test.ts`

Expected: PASS.

### Task 2: Prove the PostgreSQL developer diagnosis workflow

**Files:**
- Create: `tests/runtime/developer-diagnosis-postgres.integration.test.ts`
- Modify: `app/api/v1/memory/trace/route.ts`
- Modify: `tests/runtime/developer-api-route.test.ts`
- Modify: `tests/runtime/postgres-project-memory.integration.test.ts`

**Interfaces:**
- Consumes: `MemoryApiClient`, existing retain/recall/trace/correct/replay/evaluate routes, and PostgreSQL staging fixture conventions.
- Produces: durable readback proof for one project-scoped workflow and regression coverage for trace isolation.

- [ ] **Step 1: Write the failing PostgreSQL workflow test**

Use one authenticated developer principal and one project. Retain a fact, recall it, trace it, correct it, persist a valid replay/proposal pair, persist an evaluation run, and read the durable facts/events/evaluation artifacts back through a fresh repository instance. Assert every returned record is in the selected project.

- [ ] **Step 2: Run the focused integration test to verify its initial failure**

Run: `npx vitest run tests/runtime/developer-diagnosis-postgres.integration.test.ts`

Expected: FAIL until the missing route behavior and fixture setup are implemented.

- [ ] **Step 3: Apply project scope to trace retrieval**

Ensure `recallMemory` receives `projectId` from the validated trace input and add the unit route assertion that a matching term retained for another project is absent.

- [ ] **Step 4: Complete any minimal workflow fixture/repository changes**

Use only existing atomic retention, correction, replay, and evaluation repository methods. Do not add an orchestration write path or bypass authorization.

- [ ] **Step 5: Run focused PostgreSQL and route tests**

Run: `npx vitest run tests/runtime/developer-diagnosis-postgres.integration.test.ts tests/runtime/developer-api-route.test.ts tests/runtime/postgres-project-memory.integration.test.ts`

Expected: PASS with durable project-scoped readback.

### Task 3: Return the seven states from major developer routes

**Files:**
- Modify: `app/api/v1/memory/retain/route.ts`
- Modify: `app/api/v1/memory/recall/route.ts`
- Modify: `app/api/v1/memory/trace/route.ts`
- Modify: `app/api/v1/memory/[id]/route.ts`
- Modify: `app/api/v1/memory/replay/route.ts`
- Modify: `app/api/v1/memory/evaluate/route.ts`
- Modify: `tests/runtime/developer-api-route.test.ts`

**Interfaces:**
- Consumes: Task 1 operational-state contract.
- Produces: stable `state` in all developer route JSON envelopes.

- [ ] **Step 1: Add failing route tests for all seven states**

Use injected/runtime-safe fixtures to cover authenticated empty, queued, healthy, degraded, unavailable, failed, and unauthorized responses. Assert the state, safe error text, HTTP status, and retryable flag where applicable.

- [ ] **Step 2: Run focused route tests to verify they fail**

Run: `npx vitest run tests/runtime/developer-api-route.test.ts`

Expected: FAIL because major route envelopes lack a normalized state.

- [ ] **Step 3: Normalize success and failure envelopes at each route boundary**

Return the Task 1 `state` field while preserving present response data, authorization checks, and status codes. Treat result sets with zero items as `empty`; do not map them to runtime unavailability.

- [ ] **Step 4: Run route tests to verify they pass**

Run: `npx vitest run tests/runtime/developer-api-route.test.ts tests/runtime/operational-state.test.ts`

Expected: PASS.

### Task 4: Wire operator sections to authenticated data and states

**Files:**
- Modify: `app/sandbox/operator/[section]/page.tsx`
- Create: `lib/runtime/operator-section-data.ts`
- Create: `tests/runtime/operator-section-data.test.ts`
- Modify: `tests/e2e/operator-workspace.spec.ts`

**Interfaces:**
- Consumes: authenticated project-memory route responses and Task 1 `OperationalEnvelope`.
- Produces: `loadOperatorSectionData(section, scope)` and explicit state-specific UI rendering.

- [ ] **Step 1: Write failing loader tests**

Test each supported section (`conflicts`, `policies`, `events`, `exports`) for a typed safe response. Assert it shows `unauthorized` without a principal/scope, `unavailable` when the runtime is absent, `empty` with no records, and `healthy` with route data.

- [ ] **Step 2: Run loader tests to verify they fail**

Run: `npx vitest run tests/runtime/operator-section-data.test.ts`

Expected: FAIL because the operator page currently renders static endpoint links.

- [ ] **Step 3: Implement the authenticated operator data loader**

Use route/service boundaries only. Accept scope and principal-derived context; never hard-code `staging-*` values or query PostgreSQL from the page component.

- [ ] **Step 4: Render state-aware section content**

Replace static claims with safe data summaries and state-specific, accessible guidance. Keep endpoint downloads as explicit, authenticated actions.

- [ ] **Step 5: Run focused UI and accessibility tests**

Run: `npx vitest run tests/runtime/operator-section-data.test.ts && npm run test:e2e -- tests/e2e/operator-workspace.spec.ts`

Expected: PASS at 375, 768, and 1440 widths with no serious/critical axe violations.

### Task 5: Verify the complete browser diagnosis journey and document evidence

**Files:**
- Create: `tests/e2e/developer-diagnosis.spec.ts`
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-10-apex-control-plane-next-chat.md`

**Interfaces:**
- Consumes: Tasks 1-4 and local Docker/PostgreSQL staging.
- Produces: browser evidence from developer action through operator diagnosis.

- [ ] **Step 1: Write the failing Playwright journey**

Authenticate as the seeded developer, create and trace a project-scoped fact, perform correction/replay/evaluation, then visit the operator evidence/events/conflicts/exports sections. Assert durable IDs, state labels, keyboard focus, reduced motion, 375/768/1440 layout, and serious/critical axe results.

- [ ] **Step 2: Run the new browser test to verify the missing journey**

Run: `npm run test:e2e -- tests/e2e/developer-diagnosis.spec.ts`

Expected: FAIL until the operator route wiring and seeded staging path are complete.

- [ ] **Step 3: Implement only browser-flow gaps exposed by the test**

Keep fixtures redacted and project-scoped. Do not make external connector or provider calls.

- [ ] **Step 4: Run layered verification**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run staging:validate`

Run: `npm run test:e2e`

Run: `git diff --check`

Expected: all applicable commands pass; line-ending warnings remain reported separately if present.

- [ ] **Step 5: Update the roadmap and handoff**

Record exact commands, pass/fail counts, direct PostgreSQL/browser evidence, evidence labels, and remaining connector/provider/production boundaries.

## Plan self-review

- Spec coverage: Tasks 1-5 cover the seven states, authenticated PostgreSQL workflow, trace isolation, operator data wiring, responsive/accessible browser journey, and evidence documentation.
- Type consistency: Task 1 defines the `OperationalState` and `OperationalEnvelope` used by Tasks 3-4; Task 2 continues to use existing `MemoryApiClient` route contracts.
- Scope: no task introduces connector configuration, credentials, or external deployment.
- Review focus: each listed risk has an assigned task and explicit test.
