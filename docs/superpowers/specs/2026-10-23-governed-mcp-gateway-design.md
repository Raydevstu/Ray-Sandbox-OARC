# Governed MCP Gateway Design

Date: 2026-10-23

## Purpose

Provide Hermes, OpenCode, and future agent clients with one HTTP Model Context Protocol (MCP) gateway over the canonical PostgreSQL memory runtime. The gateway must preserve existing authorization, tenant and bank isolation, provenance, capture telemetry, and evidence rules. It must not create a second memory implementation or grant clients uncontrolled mutation capability.

## Current state and problem

The checkout already has an HTTP JSON-RPC MCP route at `app/api/mcp/route.ts`, an untyped tool builder, session helpers, the canonical memory services, and asynchronous Codex event capture. Its tool catalogue currently exposes writes and its input contract permits caller-provided scope. It also labels every gateway capture event as Codex. Those properties are incompatible with a governed shared connector boundary.

The first deliverable is therefore a hardening and typed replacement of the existing gateway surface, not a parallel server.

## Goals

- Serve standard MCP `initialize`, `tools/list`, and `tools/call` over the existing `/api/mcp` HTTP route.
- Expose only `memory_recall`, `memory_trace`, `memory_get_project_state`, and `memory_get_capture_status` in the first slice.
- Authenticate each request using the existing runtime authentication boundary and authorize `memory:read` on server-derived scope.
- Require and validate `tenantId`, `bankId`, `projectId`, `agentId`, `conversationId` or `runId`, and `correlationId` on calls; accept an idempotency key only where an operation needs one. The first four tools remain non-mutating.
- Bind the MCP session to the authenticated principal and declared connector identity, and reject changes to tenant, bank, project, agent, conversation/run, or provider during a session.
- Route recall and trace through existing canonical runtime functions and project state/capture status through existing governed read models.
- Record a redacted, provider-labelled append-only gateway event before enqueueing asynchronous processing; report capture states truthfully without making the MCP response wait for extraction.
- Return bounded structured content and stable JSON-RPC errors without raw request content, tokens, or secrets.

## Non-goals

- No retain, correction, replay, evaluation, deletion, export, or automatic mutation tools in this slice.
- No provider credentials, external deployment, live Hermes/OpenCode authorization, or production claim.
- No new database migration, provider-specific memory store, or higher concurrency workload.
- No alteration of existing Codex hook semantics; gateway events must identify their actual provider instead of being normalized as Codex by default.

## Architecture

```text
Hermes / OpenCode
       |
       | MCP JSON-RPC over HTTP, scoped bearer token
       v
/api/mcp route
  authenticate -> session identity binding -> typed input validation
       -> authorize memory:read -> canonical PostgreSQL repository
       -> redacted event ledger -> bounded async capture processing
       -> MCP structured result
```

The gateway is a transport adapter. Its route owns JSON-RPC parsing, session validation, tool dispatch, response envelopes, and error mapping. A new runtime MCP module owns typed tool definitions, schemas, request-context validation, and service adapters. Existing recall, trace, project-state, capture-status, repository, authorization, and capture-pipeline modules remain the source of behavior.

## Session and scope contract

On `initialize`, the client supplies connector metadata: `provider` (`hermes` or `opencode` for the initial integrations), `agentId`, `tenantId`, `bankId`, `projectId`, and exactly one of `conversationId` or `runId`. The server authenticates the principal, verifies the tenant and `memory:read` permission, generates a session ID, and stores an immutable normalized context plus the principal subject. The caller must send that session ID on later calls.

Every tool call supplies a `correlationId`; it must be a non-empty opaque ID. Scope fields supplied on calls must exactly match the session context; omitted scope fields are filled from it. Any mismatch receives a JSON-RPC invalid-parameters error and no repository access. Unknown tools, unknown sessions, missing project scope, or missing connector identity fail closed.

`idempotencyKey` is intentionally not required by read-only calls. It becomes mandatory only in the later governed-write slice and is then part of the durable event boundary.

## Read-only tool contracts

| Tool | Required arguments | Canonical behavior | Result |
| --- | --- | --- | --- |
| `memory_recall` | `query`, optional bounded `limit`, `policy`, `tokenBudget`, `projection`, `correlationId` | Calls scoped `recallMemory` | facts, trace ID, projection, operational state |
| `memory_trace` | `query`, `correlationId` | Calls scoped recall/trace projection | project ID, retrieval trace, bounded retrieval data, state |
| `memory_get_project_state` | optional positive `atSequence`, `correlationId` | Replays the caller's scoped project event stream into its existing manifest model | project manifest and state |
| `memory_get_capture_status` | `correlationId` | Reads capture status, reconciled only from caller-scoped durable data where available | queued/processed/failed/degraded counters and state |

The tool catalogue must not advertise a mutation tool. Tool descriptions must identify retrieved memory as untrusted evidence and state that scopes are enforced server-side.

## Capture and audit behavior

For a successful or failed tool dispatch after validation, create a gateway conversation-event envelope with provider, agent, session, conversation/run, project, tenant, bank, correlation ID, message ID, timestamp, role, tool name, and a redacted content summary. Persist the event before scheduling asynchronous work. Event IDs and future write idempotency are deterministic from the normalized gateway identity, not `Date.now()`.

The gateway response returns after durable event persistence and queue acknowledgement; it never waits for extraction, embeddings, graph work, summaries, or cleanup. If durable capture persistence cannot complete, read-only data must not be presented as a fully captured connector event; return an explicit degraded or unavailable operational state according to the existing failure contract. Logs and JSON-RPC errors contain identifiers and redacted metadata only.

## Errors and safety

- Malformed JSON-RPC: `-32700`; unsupported MCP method: `-32601`; invalid or mismatched parameters: `-32602`.
- Missing/invalid credentials: HTTP `401` with a redacted MCP error. Authenticated but unauthorized scope: HTTP `403` with a redacted MCP error.
- Store or queue unavailable: a retryable structured error with operational state `unavailable` or `degraded`.
- Tool output is serialized as MCP structured content and must not include authorization headers, tokens, raw capture payloads, or unbounded transcript content.
- Project selection never falls back to the bank, environment variables, a default project, or an existing session from another client.

## Client configuration boundary

Hermes and OpenCode configuration examples will be documentation-only templates using `RAY_MEMORY_TOKEN`, never a database URL or provider credential. Both begin with only the four read tools permitted. Exact client configuration syntax is verified only against the installed client version during local integration; the repository must not claim a successful live client connection until that path is exercised.

## Evidence and acceptance

`IMPLEMENTED` requires the typed route, context/session contract, four read-only tools, and templates. `TESTED` requires focused unit and route tests covering tool discovery, success, malformed input, missing authentication, tenant/project/session mismatch, unauthorized permission, unavailable store, secret redaction, deterministic capture identity, duplicate/retry behavior at the event boundary, and no mutation tool exposure.

`LOCALLY VERIFIED` requires separate real local Hermes and OpenCode requests through the running gateway. `BROWSER VERIFIED` requires the operator surface to display connector identity, trace, capture status, queue/degraded state, and no secret. `BENCHMARK VERIFIED` requires the fixed neutral corpus through each client with normalized recall, latency, leakage, queue, and failure results. `LIVE CONNECTOR VERIFIED` and `PRODUCTION VERIFIED` remain unclaimed until separately authorized evidence exists.

## Rollout order

1. Establish the typed read-only gateway and prove it with focused tests.
2. Run local route validation, then configure Hermes with read-only access and record only direct results.
3. Configure OpenCode with the same endpoint and read-only tool permissions and record only direct results.
4. Add governed write tools in a separate design and plan after duplicate, retry, deletion, conflict, approval, and audit evidence is available.

