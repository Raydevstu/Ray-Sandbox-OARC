# Governed MCP Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing `/api/mcp` route into a typed, read-only MCP gateway usable by Hermes and OpenCode without bypassing canonical authorization, scope, provenance, or capture rules.

**Architecture:** Keep `/api/mcp` as the sole MCP HTTP transport. Move typed tool schemas, immutable connector-session context, and read-only service adapters into `lib/runtime/mcp`; the route performs JSON-RPC/auth/session dispatch and the adapters call existing canonical retrieval, project-manifest, and capture-status services. Gateway events are provider-aware, redacted, durable-before-queue, and never delay a read response for extraction.

**Tech Stack:** Next.js 15 route handlers, TypeScript, Zod, Vitest, existing PostgreSQL repository/runtime services, MCP JSON-RPC.

**Spec:** `docs/superpowers/specs/2026-10-23-governed-mcp-gateway-design.md`

## Global Constraints

- Preserve all user-owned dirty worktree changes, `.firecrawl/`, and `test-results/`; do not reset, clean, delete, move, overwrite unrelated work, commit, deploy, or use external credentials.
- Reuse `/api/mcp`; do not add a parallel server or a provider-specific memory implementation.
- Expose only `memory_recall`, `memory_trace`, `memory_get_project_state`, and `memory_get_capture_status`; mutation tools are not advertised or callable.
- Authenticate and authorize server-side; unknown tenant, bank, project, agent, conversation/run, session, or provider scope fails closed.
- Require exact session-bound connector metadata and a correlation ID on each tool call; persist no raw secrets or unbounded raw content in logs, errors, or capture events.
- PostgreSQL remains canonical; local route tests and client templates do not establish live-connector or production evidence.
- Use two-space TypeScript indentation and semicolons.

## Review Focus

- A tenant-matching caller submits a different project, bank, or agent after initialization; reject it before repository access in Task 2.
- A client requests a previously exposed mutation tool; ensure it is absent from discovery and rejected by dispatch in Task 3.
- A request contains a bearer-like token or secret-shaped query field; ensure the returned JSON-RPC error and persisted capture projection do not echo it in Task 4.
- Capture persistence or queue acknowledgement fails after a valid read; return explicit degraded/unavailable state rather than claiming durable connector capture in Task 4.
- A session ID is replayed with a different authenticated subject or expires; reject it before tool invocation in Task 2.

---

### Task 1: Typed gateway contracts and provider-aware session context

**Files:**
- Modify: `lib/runtime/mcp/sessions.ts`
- Modify: `lib/runtime/mcp/tools.ts`
- Create: `lib/runtime/mcp/contracts.ts`
- Test: `tests/runtime/mcp-session.test.ts`
- Test: `tests/runtime/mcp-tools.test.ts`

**Interfaces:**
- Consumes: `Principal` from `lib/runtime/auth/principal.ts`.
- Produces: `McpConnectorContext`, `McpSession`, `createMcpSession(principal, context)`, `touchMcpSession(id, principal)`, `readOnlyMcpTools`, and typed per-tool Zod input schemas.
- Used by: route dispatch in Task 3 and capture normalization in Task 4.

- [ ] **Step 1: Write failing session-context tests**

Add `tests/runtime/mcp-session.test.ts` with literal contexts for a Hermes caller and an OpenCode caller. Assert that creation persists an immutable tenant/bank/project/agent/provider/conversation-or-run context, a different authenticated subject cannot touch the session, and context comparison rejects a project or provider mismatch. These tests must name the bug they catch: cross-client or cross-project session reuse.

- [ ] **Step 2: Run the session test to verify it fails**

Run: `npm test -- tests/runtime/mcp-session.test.ts`

Expected: FAIL because the current session contains only a principal and no connector context or subject validation.

- [ ] **Step 3: Implement typed MCP contracts and immutable session binding**

Create `lib/runtime/mcp/contracts.ts` with `McpConnectorContext` and Zod schemas for initialization metadata, a call correlation ID, and the four bounded read inputs. Update `lib/runtime/mcp/sessions.ts` so `createMcpSession(principal: Principal, context: McpConnectorContext): string` retains an immutable normalized context and `touchMcpSession(id: string, principal: Principal): McpSession | undefined` validates the principal subject and tenant before refreshing `lastSeenAt`.

- [ ] **Step 4: Run the session test to verify it passes**

Run: `npm test -- tests/runtime/mcp-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing read-only catalogue tests**

Add `tests/runtime/mcp-tools.test.ts` asserting discovery contains exactly the four literal read tool names and each input schema requires `correlationId`; assert no `memory_retain`, update, delete, correction, replay, or evaluation tool is present. The break caught is accidental re-exposure of a mutation tool.

- [ ] **Step 6: Run the tool test to verify it fails**

Run: `npm test -- tests/runtime/mcp-tools.test.ts`

Expected: FAIL because the current builder advertises retain, update, and delete tools with a permissive schema.

- [ ] **Step 7: Implement typed read-only tool definitions**

Replace the permissive gateway catalogue in `lib/runtime/mcp/tools.ts` with `readOnlyMcpTools` derived from the contracts. Each definition has a bounded JSON Schema, a description that identifies retrieved memory as untrusted evidence, and no executable mutation dependency. Preserve any non-gateway SDK compatibility behind separately named exports only if existing tests require it.

- [ ] **Step 8: Run the focused Task 1 tests**

Run: `npm test -- tests/runtime/mcp-session.test.ts tests/runtime/mcp-tools.test.ts tests/runtime/integration-contracts.test.ts`

Expected: PASS; update the legacy integration-contract expectation to its retained public contract or split it from gateway discovery so it does not normalize mutation exposure.

### Task 2: Scope-normalizing, read-only service adapter

**Files:**
- Create: `lib/runtime/mcp/service.ts`
- Modify: `lib/runtime/mcp/contracts.ts`
- Test: `tests/runtime/mcp-service.test.ts`

**Interfaces:**
- Consumes: `McpConnectorContext`, `CanonicalRepository`, `recallMemory`, `replayProjectMemoryAtSequence`, `generateProjectManifest`, `getCaptureStatus`, and `isRuntimeStoreConfigured`.
- Produces: `executeReadOnlyMcpTool(context, toolName, args, dependencies): Promise<McpToolResult>` and a stable operational error result.
- Used by: `app/api/mcp/route.ts` in Task 3.

- [ ] **Step 1: Write failing service tests for each consumer-visible tool**

Add literal fixtures in `tests/runtime/mcp-service.test.ts`. Cover successful scoped recall with a fixed query, trace with bounded trace data, project-state replay for the session project only, and capture-status retrieval. Add a project mismatch case that proves no repository method is reached, a missing correlation ID case, and an unavailable-store case that returns retryable `unavailable` rather than a successful content payload.

- [ ] **Step 2: Run the service test to verify it fails**

Run: `npm test -- tests/runtime/mcp-service.test.ts`

Expected: FAIL because no typed read-only MCP service adapter exists.

- [ ] **Step 3: Implement the read-only adapter**

Create `lib/runtime/mcp/service.ts`. Validate the selected tool's schema, normalize absent scope from `McpConnectorContext`, reject supplied scope that differs from it, call `authorize(principal, 'memory:read', { tenantId, bankId })`, reject an unconfigured runtime store before repository creation, and dispatch only to existing canonical services. Bound result payloads according to the schemas and return operational state with the structured result.

- [ ] **Step 4: Run the service test to verify it passes**

Run: `npm test -- tests/runtime/mcp-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Run focused authorization regression tests**

Run: `npm test -- tests/runtime/mcp-service.test.ts tests/runtime/authorization.test.ts tests/runtime/retrieval.test.ts`

Expected: PASS.

### Task 3: Harden the MCP HTTP route and protocol behavior

**Files:**
- Modify: `app/api/mcp/route.ts`
- Modify: `tests/runtime/mcp-route.test.ts`
- Test: `tests/runtime/mcp-route.test.ts`

**Interfaces:**
- Consumes: Task 1 session/contracts/tool catalogue and Task 2 service adapter.
- Produces: MCP `initialize`, `tools/list`, `tools/call`, and authenticated GET session behavior for only the governed read surface.
- Used by: local Hermes/OpenCode configuration in Task 5.

- [ ] **Step 1: Write failing route tests for the new protocol contract**

Replace the current broad tool expectations in `tests/runtime/mcp-route.test.ts` with tests that initialize using full literal connector metadata, discover exactly four read tools on the returned session, and call `memory_recall` with a matching correlation ID. Add independent tests for missing initialization metadata, missing/unknown session, changed project/agent/provider, a mutation tool call, missing `memory:read`, malformed JSON-RPC, and absent credentials. Assert HTTP `401` versus `403` and JSON-RPC error codes without asserting raw internal error strings.

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- tests/runtime/mcp-route.test.ts`

Expected: FAIL because initialize accepts empty metadata and discovery includes mutation tools.

- [ ] **Step 3: Implement read-only route dispatch**

Refactor `app/api/mcp/route.ts` to parse typed initialization context, authenticate before session use, bind/touch sessions using the requesting principal, delegate discovery to `readOnlyMcpTools`, and delegate `tools/call` to `executeReadOnlyMcpTool`. Preserve the supported MCP headers and stream behavior, map authentication/scope failures to redacted HTTP `401`/`403` responses, and do not expose `message.includes(...)` internals to clients.

- [ ] **Step 4: Run the route test to verify it passes**

Run: `npm test -- tests/runtime/mcp-route.test.ts`

Expected: PASS.

- [ ] **Step 5: Run focused protocol and runtime regression tests**

Run: `npm test -- tests/runtime/mcp-route.test.ts tests/runtime/mcp-session.test.ts tests/runtime/mcp-tools.test.ts tests/runtime/mcp-service.test.ts tests/runtime/authorization.test.ts`

Expected: PASS.

### Task 4: Provider-aware redacted capture at the gateway boundary

**Files:**
- Create: `lib/runtime/mcp/capture.ts`
- Modify: `lib/runtime/codex-ingestion.ts` or extract a provider-neutral event normalizer without changing Codex semantics
- Modify: `app/api/mcp/route.ts`
- Test: `tests/runtime/mcp-capture.test.ts`
- Test: `tests/runtime/codex-ingestion.test.ts`

**Interfaces:**
- Consumes: `McpConnectorContext`, tool-call/result values, `CanonicalRepository`, `createAsyncProjectMemoryDispatcher`, and `recordCapture`.
- Produces: `persistMcpGatewayEvent(...)` that records provider-aware, redacted durable events and returns queue acknowledgement/state.
- Used by: successful and rejected-after-validation route dispatches.

- [ ] **Step 1: Write failing capture tests**

Add `tests/runtime/mcp-capture.test.ts` proving an OpenCode call produces a provider-labelled event with literal project, agent, session, correlation, and tool identity; that `Authorization`, `apiKey`, `token`, and raw content do not appear in its serializable event projection; that a deterministic duplicate call has the same idempotency/event identity; and that persistence or queue failure yields explicit degraded/unavailable state. Keep a separate Codex regression test asserting existing Codex normalization remains `platform: 'codex'`.

- [ ] **Step 2: Run capture tests to verify they fail**

Run: `npm test -- tests/runtime/mcp-capture.test.ts tests/runtime/codex-ingestion.test.ts`

Expected: FAIL because the route currently normalizes gateway calls as Codex and uses clock-derived message IDs.

- [ ] **Step 3: Implement provider-neutral gateway capture**

Create `lib/runtime/mcp/capture.ts` with redaction and deterministic identity derived from normalized provider, agent, session, correlation, tool, and project fields. Persist the input event before dispatching asynchronous processing, record each capture lifecycle state, and return a bounded acknowledgement. Reuse or minimally extract provider-neutral normalization from `lib/runtime/codex-ingestion.ts`; keep Codex APIs and their existing provenance unchanged.

- [ ] **Step 4: Integrate capture without blocking read work**

Update the MCP route to invoke capture after validation and before returning tool content. Do not await extraction/embedding/graph processing; require durable-event acknowledgement before claiming capture success. Convert capture persistence/queue failures into the explicit operational state defined by the spec.

- [ ] **Step 5: Run capture tests to verify they pass**

Run: `npm test -- tests/runtime/mcp-capture.test.ts tests/runtime/codex-ingestion.test.ts tests/runtime/capture-status.test.ts`

Expected: PASS.

### Task 5: Local client templates, documentation, and evidence update

**Files:**
- Create: `docs/integrations/hermes-mcp-readonly.example.yaml`
- Create: `docs/integrations/opencode-mcp-readonly.example.json`
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Modify: `docs/superpowers/handoffs/2026-10-23-hermes-opencode-mcp-next-chat.md`
- Test: `tests/runtime/mcp-route.test.ts`

**Interfaces:**
- Consumes: the final `/api/mcp` protocol and four tool names from Task 3.
- Produces: redacted documentation-only configuration templates and accurate evidence labels.
- Used by: authorized local Hermes/OpenCode connection verification after implementation.

- [ ] **Step 1: Write failing template-safety tests only if a runtime template loader is introduced**

Do not add source-text tests for human documentation. If implementation adds a template parser or loader, write a behavior test that loads a template with `RAY_MEMORY_TOKEN` and confirms it neither reads database/provider credentials nor permits a mutation tool. Otherwise this step is intentionally not applicable.

- [ ] **Step 2: Add redacted client templates and update evidence documents**

Create documentation-only templates that point at `http://127.0.0.1:3028/api/mcp`, reference `RAY_MEMORY_TOKEN`, and allow only the four read tools. State that exact syntax must be checked against the installed client version. Update the roadmap and handoff with only evidence earned by this work: `IMPLEMENTED` and `TESTED` after successful verification; leave `LOCALLY VERIFIED`, `BROWSER VERIFIED`, `BENCHMARK VERIFIED`, `LIVE CONNECTOR VERIFIED`, and `PRODUCTION VERIFIED` pending until their direct gates run.

- [ ] **Step 3: Run focused final gateway verification**

Run: `npm test -- tests/runtime/mcp-route.test.ts tests/runtime/mcp-session.test.ts tests/runtime/mcp-tools.test.ts tests/runtime/mcp-service.test.ts tests/runtime/mcp-capture.test.ts tests/runtime/authorization.test.ts tests/runtime/codex-ingestion.test.ts tests/runtime/capture-status.test.ts`

Expected: PASS.

- [ ] **Step 4: Run proportional repository validation**

Run: `npm run typecheck` and then `npm test`

Expected: both exit `0`; report any existing failure separately rather than attributing it to the gateway.

- [ ] **Step 5: Inspect the final diff and record evidence limits**

Run: `git diff --check` followed by `git diff -- app/api/mcp/route.ts lib/runtime/mcp tests/runtime/mcp* docs/integrations docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md docs/superpowers/handoffs/2026-10-23-hermes-opencode-mcp-next-chat.md`

Expected: no whitespace errors; every diff is within the governed gateway boundary. Do not commit without explicit authorization.

## Plan self-review

- Spec coverage: Tasks 1–4 implement typed contracts, scope/session enforcement, the four read tools, existing canonical adapters, provider-aware durable capture, async processing, redaction, and error mapping. Task 5 supplies client templates and evidence updates. Deferred writes and external proof remain explicitly out of scope.
- Type consistency: `McpConnectorContext` and `McpSession` originate in Task 1; Task 2 consumes them; Task 3 invokes Task 2; Task 4 uses the same context for durable capture.
- Review focus: each listed safety failure is assigned to Tasks 1–4 with a specific test cycle.
- Proportion: implementation is divided into five independently reviewable vertical tasks and does not prescribe application bodies beyond their contracts.

