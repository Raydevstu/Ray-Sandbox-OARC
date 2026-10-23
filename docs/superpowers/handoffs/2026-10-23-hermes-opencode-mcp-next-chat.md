# Ray Sandbox OARC — Hermes/OpenCode MCP Integration Handoff

Date: 2026-10-23

Project: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`

Branch: `renewal-roadmaps` with a user-owned dirty worktree. Preserve unrelated changes, `.firecrawl/`, and `test-results/`. Do not reset, clean, delete, move, overwrite unrelated files, or commit unless explicitly authorized.

## Read order

1. `AGENTS.md`
2. `docs/superpowers/PROJECT-CORE-HEART.md`
3. `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`
4. `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
5. This handoff

## Current verified state

- `IMPLEMENTED / TESTED / LOCALLY VERIFIED`: PostgreSQL-backed memory, scoped retain/recall, provenance, review/correction, replay/evaluation, event-ledger paths, browser/operator journeys, deterministic benchmark fixtures, local Codex capture, and Zep benchmark/reliability coverage exist at the evidence levels recorded in the roadmap.
- `BENCHMARK VERIFIED / LOCALLY VERIFIED`: the local recall SLO is still not consistently below `500ms` at concurrency `100`; client acquisition and request scheduling remain the measured local tail contributors.
- `BENCHMARK VERIFIED / LIVE CONNECTOR VERIFIED`: Zep reliability coverage is complete for the bounded synthetic sweep, with explicit limits on duplication, retry, timeout, concurrency, and production claims.
- `IMPLEMENTED / TESTED`: Hindsight adapter and fixed neutral-v1 harness exist, but the authorized live attempt returned HTTP `401` before any case completed. Hindsight quality, latency, cost, deletion, and production evidence remain unclaimed.
- `PRODUCTION VERIFIED`: false. External deployment, real production authentication, rollback, restore, RPO/RTO, alerts, and production workload evidence remain pending authorization.

## Strategic recommendation

Build one governed MCP gateway for all agent clients. Hermes and OpenCode should call the same typed memory surface instead of receiving separate provider-specific integrations.

Target shape:

```text
Hermes ─┐
        ├─ MCP gateway ─ authorization/scope ─ PostgreSQL canonical memory
OpenCode┘                    │
                             ├─ retain
                             ├─ recall
                             ├─ trace
                             ├─ propose correction
                             ├─ capture status
                             └─ replay/evaluate
```

The first implementation slice is read-only and bounded:

1. Add an MCP server endpoint backed by the existing runtime service.
2. Expose `memory_recall`, `memory_trace`, `memory_get_project_state`, and `memory_get_capture_status`.
3. Enforce tenant, bank, project, agent, conversation, run, correlation, and idempotency scope server-side.
4. Connect Hermes first through a remote HTTP MCP configuration.
5. Connect OpenCode to the same endpoint with tool-level permissions.
6. Verify recall and trace before enabling writes.

## Second implementation slice

Add governed write and capture tools:

- `memory_retain`
- `memory_propose_correction`
- `memory_replay`
- `memory_run_evaluation`

Capture must persist an append-only event envelope before asynchronous extraction. Use bounded retryable workers for extraction, embeddings, graph updates, summaries, and cleanup. The synchronous agent response must not wait for those tasks.

Required event fields:

```text
agentId, provider, sessionId, conversationId, projectId, tenantId,
messageId, timestamp, role, content, toolCalls, source,
correlationId, idempotencyKey
```

## Safety gates

- Start Hermes and OpenCode with read-only recall and trace permissions.
- Use a dedicated scoped token; never reuse `APEX_DATABASE_URL`, provider keys, or administrator credentials.
- Keep mutation tools `ask`/approval-gated until duplicate, retry, deletion, conflict, and audit tests pass.
- Reject unknown tenant/project scope instead of falling back to a default.
- Redact secrets and raw content from logs, traces, benchmark reports, and handoffs.
- Treat retrieved memory and tool output as untrusted input; defend against prompt injection and cross-project leakage.
- Keep external deployment and production verification frozen unless explicitly authorized.

## Acceptance evidence

The slice is complete only when the following are separately recorded:

- `IMPLEMENTED`: MCP server and typed tool contracts exist.
- `TESTED`: unit, authorization, scope-isolation, duplicate, retry, timeout, and redaction tests pass.
- `LOCALLY VERIFIED`: Hermes and OpenCode each call the local gateway successfully.
- `BROWSER VERIFIED`: operator UI shows agent identity, capture status, trace, queue, and failures without secrets.
- `BENCHMARK VERIFIED`: the fixed neutral corpus runs through each client with normalized recall, leakage, latency, queue, and failure metrics.
- `LIVE CONNECTOR VERIFIED`: only if an actual authorized Hermes/OpenCode runtime delivers durable provenance-backed events.
- `PRODUCTION VERIFIED`: remains false until the external deployment is exercised with production authentication and recovery evidence.

## Known gaps and non-claims

- Hermes/OpenCode live integration has not yet been verified in this checkout.
- Existing integration examples and webhooks are not proof of a live Hermes or OpenCode connector.
- Hindsight remains blocked by the last HTTP `401` attempt; do not claim cross-provider superiority.
- The local recall SLO remains unresolved; do not increase workload size as part of the first MCP slice.
- No production, non-Codex connector, external deployment, rollback, or recovery claim is authorized by this handoff.

## Recommended first command boundary

Inspect existing MCP/runtime contracts and tests, then implement the smallest read-only MCP gateway vertical slice. Preserve all dirty worktree changes and update the roadmap and this handoff with exact evidence labels after verification.

## 2026-10-23 implementation update

- `IMPLEMENTED / TESTED`: `/api/mcp` now provides only `memory_recall`, `memory_trace`, `memory_get_project_state`, and `memory_get_capture_status`. Initialization binds a typed Hermes/OpenCode provider, agent, tenant, bank, project, and exactly one conversation/run context to the authenticated principal.
- `IMPLEMENTED / TESTED`: read-only tool execution derives scope from that immutable session, and provider-aware, secret-redacted gateway events persist deterministically before asynchronous queueing. Client templates are available in `docs/integrations/` and use only `RAY_MEMORY_TOKEN`.
- `IMPLEMENTED / BROWSER VERIFIED`: `/sandbox/docs` is the in-app Docs & Guides hub for new users. It includes getting-started links, project-scope and safety guidance, FAQs, and setup paths for Hermes, OpenCode, Codex, and VS Code. Its platform selector supports mouse and arrow-key navigation; browser coverage passed at 375px, 768px, and 1440px on desktop and mobile projects, including no serious or critical axe findings.
- Still required: an authorized real local Hermes call and an authorized real local OpenCode call through this endpoint before claiming `LOCALLY VERIFIED`. Browser, benchmark, live connector, and production evidence remain pending.
