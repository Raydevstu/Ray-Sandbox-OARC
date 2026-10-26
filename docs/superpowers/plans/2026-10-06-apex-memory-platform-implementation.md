# Apex Memory Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Hindsight Sandbox into a dual-plane memory platform while preserving the deterministic browser sandbox and adding a tenant-scoped, durable runtime behind explicit contracts.

**Architecture:** Keep the existing pure TypeScript engines as the deterministic reference plane. Add a runtime plane inside the current Next.js application, organized behind domain services, repository/provider ports, versioned route handlers, and database-backed workers. Canonical PostgreSQL state is authoritative; lexical, vector, graph, layer, cache, and integration records are rebuildable projections.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, PostgreSQL 16, Drizzle ORM and Drizzle Kit migrations, Zod boundary schemas, jose JWT/JWKS validation, database-backed jobs, existing Zustand UI state, and Vitest-compatible test tooling selected to match the repository's final test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-apex-memory-platform-design.md`

## Audit status — 2026-10-07

Status meanings: `IMPLEMENTED` means the source exists and the intended slice is present; `TESTED/RUNNING` means direct verification passed; `PENDING` means planned but not implemented or not fully wired; `NOT FUNCTIONING` means a verification gate currently fails.

Current UI implementation checkpoint: the V2 design blueprint is active on branch `V2-design`. V2.1 visual foundations and V2.2 evidence-first memory workbench are implemented and validated by typecheck, test, lint, and build. The next boundary is V2.3 live observability charts; browser E2E for the V2.2 workflow remains an explicit pending gate.

| Area | Status | Evidence / remaining gap |
|---|---|---|
| Tasks 1–4: contracts, repository, retention, lexical retrieval | `IMPLEMENTED` / `TESTED/RUNNING` | Runtime tests pass (35 tests); live PostgreSQL retain/recall smoke test passes. The repository is a parameterized `pg` implementation, not the Drizzle repository specified by the original plan. |
| Task 5: durable consumers and rebuilds | `PARTIAL` / `PENDING` | Queue/checkpoint/rebuild contracts and tests exist, but production worker routes and PostgreSQL projection consumers are not complete. |
| Task 6: dense retrieval and graph projection | `PARTIAL` / `PENDING` | Dense/graph provider contracts exist and deterministic tests pass; PostgreSQL search/graph migration and live provider-backed retrieval are not complete. |
| Task 7: REST, MCP, SDK, adapters | `IMPLEMENTED` / `TESTED/RUNNING` | Contract tests pass; health/ready/retain/recall routes and adapters exist. Authentication is not wired into the route handlers. |
| Task 8: UI/runtime mode and operator surfaces | `IMPLEMENTED` / `TESTED/RUNNING` | UI mode, health visibility, traces, citations, and repair controls exist; runtime database health is now `healthy` locally. Browser E2E is not verified. |
| Task 9: self-healing, snapshots, security, readiness | `PENDING` | Repair/snapshot operation routes, restore drills, rate limiting, security gates, runbooks, and production readiness evidence remain. |
| Full automated validation matrix | `TESTED/RUNNING` | Vitest alias and test-runner configuration fixed; `npm test` now passes 19 files and 53 tests. Browser E2E, load, restore, security, and production deployment gates remain pending. |

### Current verified runtime path

- `npm run typecheck`: `TESTED/RUNNING`.
- `npm test -- --run tests/runtime`: `TESTED/RUNNING`, 35 tests passed.
- `npm run db:status:postgres`: `TESTED/RUNNING`, schema ready.
- `npm run db:migrate:postgres`: `TESTED/RUNNING`.
- `npm run smoke:postgres`: `TESTED/RUNNING`, live retain/recall passed.
- `/api/v1/ready`: `TESTED/RUNNING`, HTTP 200 locally.
- `/sandbox/integrations`: `TESTED/RUNNING`, HTTP 200 locally.
- Browser E2E: `TESTED/RUNNING` for memory retain → recall → cited digest, runtime mode/health controls, and settings operator surfaces. The integrations page has HTTP coverage; download/interaction coverage remains pending.
- `npm run build`: `TESTED/RUNNING`; production build completes. Non-blocking warnings remain for multiple lockfiles and unused image eslint directives.
- `npm run lint`: `TESTED/RUNNING`; exits successfully with the same non-blocking unused eslint-disable warnings.

## Global Constraints

- Canonical memory is authoritative; indexes, graphs, layers, caches, and integration payloads are derived.
- Every accepted memory claim has evidence and provenance.
- Memory is immutable by revision; consolidation creates new versions rather than silent overwrites.
- Tenant and bank scope are enforced at API, application-service, repository, and worker boundaries.
- All state-changing operations are idempotent and evented.
- Derived projections are rebuildable from canonical state and event history.
- The deterministic sandbox must not acquire an LLM or network dependency.
- Self-healing may retry, replay, rebuild, invalidate, fall back, or enter read-only mode, but may not perform destructive canonical mutation automatically.
- No injected context item may exceed 10K tokens; all packed context has a hard configured budget.
- Changed source files stay focused, with functions under 50 lines where practical and files under 800 lines.

## Review Focus

- Cross-tenant identifiers supplied through headers, query parameters, cursors, cache keys, and worker payloads must never affect another tenant; test repository and route rejection.
- Reused idempotency keys with different payload hashes must fail without a second canonical revision; test both retain and event consumers.
- Superseded facts must disappear from `current` results but remain available to `historical` and `all-evidence`; test lineage and citations.
- Partial provider or projection failure must preserve canonical writes and expose degraded status; test lexical-only recall and repair replay.
- Malformed, oversized, secret-bearing, or ambiguous external input must fail closed without leaking raw content into errors, logs, or traces; test API schemas and redaction.

## Implementation Decisions

- The first runtime slice stays inside `hindsight-memory-slice` so deterministic and runtime contract tests share fixtures; service extraction is deferred until measured load or deployment isolation requires it.
- PostgreSQL 16 is the production canonical store. Drizzle ORM/Kit owns typed queries and migrations; repositories remain the only data-access surface.
- The initial durable job mechanism is a PostgreSQL jobs table with leases, retry count, and dead-letter state. A queue platform is deferred until load testing demonstrates the need.
- Identity accepts a JWT issuer/JWKS configuration in runtime environments and an explicit development principal only when `ALLOW_DEV_PRINCIPAL=true`; authorization is represented by typed scopes.
- Dense retrieval is provider-backed and disabled by default until an embedding model and vector-capable deployment are configured. Lexical retrieval is the first production retrieval provider and the required degraded mode.
- The initial graph projection uses relational PostgreSQL tables and bounded SQL traversal; a graph database is not introduced without measured workload evidence.
- Snapshots use an object-storage adapter contract with a local filesystem adapter for development and restore drills; credentials and vendor SDKs are outside the first slice.

## File Map

Create focused runtime modules under `lib/runtime/` for contracts, config, authorization, repositories, services, providers, jobs, repair, and redaction. Add `app/api/v1/` route handlers only as thin boundary adapters. Keep `lib/engine/` unchanged except for shared fixture/type compatibility. Add `db/` migrations and `tests/runtime/` integration/contract coverage. Extend existing sandbox UI only after runtime routes and mode switching are proven.

### Task 1: Runtime foundation and canonical schemas

**Files:**
- Create: `lib/runtime/contracts.ts`, `lib/runtime/errors.ts`, `lib/runtime/schemas.ts`
- Create: `lib/runtime/config.ts`, `lib/runtime/redaction.ts`
- Create: `db/schema.ts`, `db/migrations/0001_canonical_memory.sql`
- Create: `tests/runtime/contracts.test.ts`, `tests/runtime/config.test.ts`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- `MemoryScope = { tenantId: string; bankId: string }`
- `MemoryFactRevision`, `EvidenceRecord`, `EventRecord`, `OutboxRecord`, `RetrievalRequest`, `RetrievalResponse`, `HealthReport`
- `parseRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig`
- `redactSecrets(value: unknown): unknown`

- [ ] Write failing tests for schema rejection, stable IDs, scope requirements, config validation, and recursive secret redaction.
- [ ] Run the focused tests and verify failure on missing contracts/config functions.
- [ ] Implement immutable domain types, Zod schemas, typed errors, config defaults, and migration tables for tenants, banks, facts, evidence, entities, edges, layers, events, outbox, jobs, feedback, snapshots, and retrieval traces.
- [ ] Run typecheck and focused tests; verify migration SQL has tenant/bank indexes and uniqueness for `(tenant_id, idempotency_key)`.
- [ ] Commit `feat: add apex runtime contracts and canonical schema`.

### Task 2: Authorization and repository ports

**Files:**
- Create: `lib/runtime/auth/principal.ts`, `lib/runtime/auth/authorize.ts`, `lib/runtime/auth/jwks.ts`
- Create: `lib/runtime/repositories/interfaces.ts`, `lib/runtime/repositories/postgres.ts`, `lib/runtime/repositories/test-double.ts`
- Create: `tests/runtime/authorization.test.ts`, `tests/runtime/repositories.test.ts`

**Interfaces:**
- `Principal = { subject: string; tenantId: string; scopes: ReadonlySet<Permission>; source: "jwt" | "dev" | "service" }`
- `authenticateRequest(request: Request, config: RuntimeConfig): Promise<Principal>`
- `authorize(principal: Principal, permission: Permission, scope: MemoryScope): void`
- `CanonicalRepository` methods: `appendRevision`, `findFacts`, `appendEvent`, `claimJobs`, `saveProjection`, `getByIdempotencyKey`, `writeSnapshot`

- [ ] Write failing tests for missing credentials, invalid issuer/signature, scope mismatch, insufficient permission, and repository tenant filtering.
- [ ] Run tests to confirm authorization and repository ports are absent/failing.
- [ ] Implement JWKS-backed authentication, explicit development-principal guard, scope checks, repository interfaces, and a test double that applies the same scope predicates as PostgreSQL.
- [ ] Implement parameterized Drizzle repository methods without exposing raw database handles to services.
- [ ] Run focused tests and a migration-backed repository integration test against the configured local PostgreSQL test database.
- [ ] Commit `feat: enforce scoped runtime authorization and repositories`.

### Task 3: Retention service, idempotency, and outbox

**Files:**
- Create: `lib/runtime/retention/normalize.ts`, `lib/runtime/retention/service.ts`, `lib/runtime/retention/entity-resolution.ts`
- Create: `lib/runtime/events/envelope.ts`, `lib/runtime/events/outbox.ts`
- Create: `app/api/v1/memory/retain/route.ts`
- Create: `tests/runtime/retention.test.ts`, `tests/runtime/api-retain.test.ts`

**Interfaces:**
- `retainMemory(input: RetainRequest, deps: RetentionDependencies): Promise<RetainResponse>`
- `normalizeSource(input: RetainRequest): NormalizedSource`
- `createEventEnvelope<T>(input: EventInput<T>): EventRecord`

- [ ] Write failing tests for validation, normalization, evidence attachment, duplicate/contradiction handling, idempotent replay, payload-hash conflict, and atomic event/outbox creation.
- [ ] Run focused tests and confirm RED before implementation.
- [ ] Implement the retention pipeline using existing deterministic extraction as the reference behavior, creating immutable revisions and provenance-backed evidence in one transaction.
- [ ] Add the thin authenticated route with request ID, consistent response envelope, safe errors, and idempotency headers.
- [ ] Run unit, repository, and API contract tests; verify the second identical request returns the original result and emits no duplicate event.
- [ ] Commit `feat: add durable scoped retention pipeline`.

### Task 4: Lexical retrieval, temporal policies, layers, and packing

**Files:**
- Create: `lib/runtime/providers/lexical.ts`, `lib/runtime/retrieval/query-intent.ts`, `lib/runtime/retrieval/fusion.ts`
- Create: `lib/runtime/retrieval/service.ts`, `lib/runtime/retrieval/layers.ts`, `lib/runtime/retrieval/packing.ts`
- Create: `app/api/v1/memory/recall/route.ts`
- Create: `tests/runtime/retrieval.test.ts`, `tests/runtime/api-recall.test.ts`

**Interfaces:**
- `recallMemory(input: RetrievalRequest, deps: RetrievalDependencies): Promise<RetrievalResponse>`
- `LexicalProvider.search(request: LexicalSearchRequest): Promise<RankedCandidate[]>`
- `packContext(candidates: RankedCandidate[], budget: number): PackedContext`
- `applyTemporalPolicy(candidates: RankedCandidate[], policy: RetrievalPolicy): RankedCandidate[]`

- [ ] Write failing tests for current/history/all-evidence, lexical scoring, RRF fusion, explicit scope filtering before ranking, L0/L1/L2 fallback, citation preservation, abstention, and hard token budgets.
- [ ] Run focused tests and confirm RED.
- [ ] Implement deterministic lexical retrieval over canonical records, policy-aware supersession filtering, provider-neutral fusion, bounded trace stages, and versioned layer selection.
- [ ] Add the authenticated recall route with bounded trace levels and degraded metadata.
- [ ] Run retrieval regression fixtures against the existing deterministic engine and runtime API contract tests.
- [ ] Commit `feat: add scoped lexical recall and layered context`.

### Task 5: Durable consumers, checkpoints, and rebuilds

**Files:**
- Create: `lib/runtime/jobs/queue.ts`, `lib/runtime/jobs/worker.ts`, `lib/runtime/jobs/checkpoints.ts`
- Create: `lib/runtime/projections/lexical.ts`, `lib/runtime/projections/layers.ts`, `lib/runtime/projections/rebuild.ts`
- Create: `app/api/v1/operations/replay/route.ts`, `app/api/v1/operations/jobs/route.ts`
- Create: `tests/runtime/jobs.test.ts`, `tests/runtime/rebuild.test.ts`

**Interfaces:**
- `enqueueProjectionJob(event: EventRecord): Promise<JobRecord>`
- `runJob(job: JobRecord, deps: WorkerDependencies): Promise<JobResult>`
- `rebuildProjection(scope: MemoryScope, projection: ProjectionName): Promise<RebuildReport>`

- [ ] Write failing tests for lease acquisition, FIFO ordering, retry backoff, dead letters, checkpoint resume, idempotent projection writes, and rebuild equivalence.
- [ ] Implement database-backed jobs with bounded retries and explicit dead-letter state; consumers must be safe to restart.
- [ ] Implement lexical/layer projection consumers and operator-authorized replay/rebuild routes.
- [ ] Run restart simulation, duplicate delivery, and rebuild tests with PostgreSQL.
- [ ] Commit `feat: add durable projection workers and rebuilds`.

### Task 6: Dense retrieval adapter and relational graph projection

**Files:**
- Create: `lib/runtime/providers/embeddings.ts`, `lib/runtime/providers/dense.ts`, `lib/runtime/providers/reranker.ts`
- Create: `lib/runtime/projections/graph.ts`, `lib/runtime/graph/traversal.ts`, `lib/runtime/graph/entity-resolution.ts`
- Modify: `lib/runtime/retrieval/service.ts`, `db/migrations/0002_search_and_graph.sql`
- Create: `tests/runtime/dense-provider.test.ts`, `tests/runtime/graph.test.ts`

**Interfaces:**
- `EmbeddingProvider.embed(input: string): Promise<ReadonlyArray<number>>`
- `DenseProvider.search(request: DenseSearchRequest): Promise<RankedCandidate[]>`
- `Reranker.rank(request: RerankRequest): Promise<RankedCandidate[]>`
- `expandGraph(request: GraphExpansionRequest): Promise<GraphNeighborhood>`

- [ ] Write failing tests for provider-disabled behavior, vector dimension mismatch, dense/lexical fusion, stable entity resolution, bounded hops/nodes/edges, and tenant-safe graph traversal.
- [ ] Implement provider ports and configuration-gated adapters; a missing provider must leave lexical recall healthy.
- [ ] Implement relational entity/edge projections from canonical events and bounded traversal with relation allowlists.
- [ ] Run retrieval and graph tests with dense providers both enabled and unavailable; verify no external provider is required by deterministic tests.
- [ ] Commit `feat: add optional dense retrieval and bounded graph memory`.

### Task 7: REST, MCP, SDK, and integration adapters

**Files:**
- Create: `app/api/v1/memory/[id]/route.ts`, `app/api/v1/health/route.ts`, `app/api/v1/ready/route.ts`, `app/api/v1/metrics/route.ts`
- Create: `lib/runtime/mcp/tools.ts`, `lib/runtime/sdk/client.ts`, `lib/runtime/integrations/adapters.ts`
- Modify: `lib/integrations/adapters.ts`
- Create: `tests/runtime/integration-contracts.test.ts`, `tests/runtime/mcp-equivalence.test.ts`

**Interfaces:**
- `MemoryApiClient.retain`, `MemoryApiClient.recall`, `MemoryApiClient.get`, `MemoryApiClient.feedback`
- `buildMcpTools(deps): ReadonlyArray<McpToolDefinition>`
- `buildIntegrationPayload(event, target): IntegrationPayload`

- [ ] Write failing tests for response envelopes, pagination/cursors, health/readiness component states, REST/MCP equivalence, simulated/live labels, and secret-free payloads.
- [ ] Implement thin routes and adapters that call the same application services and never claim external delivery for simulation.
- [ ] Add contract tests for Codex, Claude Code, OpenClaw, Hermes, n8n, Zapier, and generic webhook payload shapes.
- [ ] Run API, MCP, and adapter suites plus route smoke tests.
- [ ] Commit `feat: expose versioned memory integrations`.

### Task 8: UI/runtime mode and operator surfaces

**Files:**
- Create: `lib/runtime/ui-mode.ts`, `lib/runtime/client.ts`
- Modify: `lib/store.ts`, `app/sandbox/memory/page.tsx`, `app/sandbox/integrations/page.tsx`, `app/sandbox/settings/page.tsx`
- Create: `components/memory/RuntimeStatus.tsx`, `components/memory/RepairPanel.tsx`
- Create: `tests/runtime/ui-mode.test.ts`

**Interfaces:**
- `RuntimeMode = "deterministic" | "runtime"`
- `createMemoryClient(mode, config): MemoryClient`
- `RuntimeStatus` shows component health, degraded reason, projection lag, and request ID.

- [ ] Write failing tests for explicit mode persistence, no silent fallback from runtime to deterministic mode, bounded trace rendering, and operator permission gating.
- [ ] Implement mode-aware client/store actions while preserving existing localStorage migration behavior and deterministic pages.
- [ ] Add runtime status, repair request, trace, citation, and degraded-state UI with accessible loading/error states.
- [ ] Run typecheck, lint, existing engine tests, runtime tests, and browser smoke checks for deterministic and runtime mode.
- [ ] Commit `feat: connect sandbox UI to explicit runtime modes`.

### Task 9: Self-healing, snapshots, security, and readiness gates

**Files:**
- Create: `lib/runtime/operations/health.ts`, `lib/runtime/operations/repair.ts`, `lib/runtime/operations/snapshots.ts`
- Create: `app/api/v1/operations/repair/route.ts`, `app/api/v1/operations/snapshots/route.ts`
- Create: `tests/runtime/repair.test.ts`, `tests/runtime/snapshot-restore.test.ts`, `tests/runtime/security.test.ts`
- Create: `docs/runbooks/apex-memory-operations.md`, `docs/runbooks/apex-memory-readiness.md`

**Interfaces:**
- `collectHealth(deps): Promise<HealthReport>`
- `requestRepair(input, principal): Promise<RepairRecord>`
- `createSnapshot(scope, principal): Promise<SnapshotRecord>`
- `restoreSnapshot(snapshotId, principal): Promise<RestoreReport>`

- [ ] Write failing tests for transient retry, persistent drift classification, authorized rebuild, forbidden destructive repair, snapshot checksum/restore, secret redaction, rate limits, and read-only degraded mode.
- [ ] Implement bounded repair actions, audit records, component health, local snapshot adapter, and operator-authorized routes.
- [ ] Add runbooks defining rollback, restore drill, dead-letter handling, provider outage behavior, and evidence required for each provisional SLO.
- [ ] Run security tests, restore drills, load benchmarks, browser E2E, API/MCP equivalence, and full typecheck/build/lint gates.
- [ ] Commit `feat: add bounded recovery and production readiness gates`.

## Final Verification and Handoff

- [ ] Review the complete diff for tenant isolation, idempotency, secret handling, generated files, and unrelated dirty-worktree changes.
- [ ] Run the full validation matrix: typecheck, lint, unit/engine tests, PostgreSQL integration tests, API contract tests, browser E2E, MCP equivalence, security tests, load tests, restore drill, and production build.
- [ ] Record verified versus unverified claims in `docs/runbooks/apex-memory-readiness.md`; do not call the system production-ready if identity, deployment, provider, restore, or SLO evidence is missing.
- [ ] Request an independent code/security review before merging; use a conventional commit per completed milestone and preserve the deterministic sandbox as a regression gate.
