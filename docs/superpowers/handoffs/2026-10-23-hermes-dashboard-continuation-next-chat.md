# Ray Sandbox OARC — Hermes + Live Dashboard Continuation Handoff

## Purpose

Continue the local Hermes integration and truthful project dashboard work for the `ray-dashboard-test` project.

This handoff supplements, rather than replaces, the earlier dashboard handoff:
`docs/superpowers/handoffs/2026-10-23-live-dashboard-continuation-next-chat.md`.

## Current outcome

The MCP worker acknowledgement path was repaired after a live audit found that
the route returned after queue submission without awaiting the durable async
enqueue/drain path or recording the processed lifecycle stage. Capture now
awaits `enqueueAsync` when available, and the MCP dispatcher records processed
events through its worker callback.

A fresh local Hermes JSON-RPC session subsequently completed retain -> worker ->
recall for `demo-tenant` / `bank-a` / `ray-dashboard-test`: canonical fact,
evidence, and event IDs were returned; recall returned the retained fact; and
capture status reached `processed: 1` with `failed: 0`. The browser dashboard
showed `MEMORIES 2`, `OPERATIONS 8`, `FAILURES 0`, and the scoped event stream.

MCP gateway events now carry bounded duration/outcome observations, and the
dashboard rebuilds measured latency from those durable observations when the
process-local registry is empty. A fresh dashboard API read after a Hermes
recall reported `memoryCount: 2`, `mcp: 9`, `failures: 0`, and measured
`p50/p95: 171/171ms` with one durable latency sample.

Telemetry remains `Stale` only for historical or operation streams that have no
real measurement sample; the UI does not fabricate values.

The local integration path is working end to end:

- Hermes uses the stdio proxy at `scripts/hermes-mcp-proxy.mjs`.
- The proxy injects governed local-development context and forwards requests to `http://127.0.0.1:3030/api/mcp`.
- `memory_retain` is available when Hermes has `memory:write`.
- A real local retain request through that proxy created one canonical fact, one evidence row, and durable project events for `ray-dashboard-test`.
- The dashboard now reads canonical facts when the older project-memory projection has not yet been populated. The browser showed `MEMORIES 1`, `OPERATIONS 5`, and `FAILURES 0` for `bank-a` / `ray-dashboard-test`.

No commit was created. Preserve the extensive existing dirty and untracked worktree.

## Evidence status

| Area | State | Evidence |
| --- | --- | --- |
| Hermes stdio proxy | IMPLEMENTED | `scripts/hermes-mcp-proxy.mjs` and Hermes command-mode configuration point to it. |
| MCP retain tool | IMPLEMENTED / TESTED | `memory_retain` is authorization-gated in `lib/runtime/mcp/service.ts`; MCP service tests cover it. |
| Canonical dashboard count | IMPLEMENTED / TESTED | `lib/runtime/project-dashboard-service.ts` prefers canonical facts when available; focused dashboard service suite passed 4 tests. |
| Local canonical write | LOCALLY VERIFIED | Local PostgreSQL contains one fact and one evidence record in `demo-tenant` / `bank-a`; project event count was 5. |
| Dashboard selection and values | BROWSER VERIFIED | `http://127.0.0.1:3030/sandbox`, selected `ray-dashboard-test`, showed Memories 1, Operations 5, Failures 0. |
| Direct live Hermes desktop save after repair | NOT separately verified | The same proxy protocol was exercised locally. Hermes had discovered all five tools, but its historical failed save remains part of chat history. |
| Production / external connector | NOT VERIFIED | Local Docker/PostgreSQL and local desktop integration only. |

## Important truth about the charts

The interactive panels exist and work: pause, zoom, reset, and table controls are available on the telemetry cards.

The charts must remain empty or `Stale` until their corresponding real measurements exist. The first retained fact legitimately updates the memory and operation cards, but it does **not** create:

- measured latency samples;
- queue-pressure samples;
- typed legacy project-memory records required for World / Experience / Observation / Opinion distribution.

Do not seed or fabricate graph values merely to make the charts look full. Generate more authorized operations, then inspect which measurement stream they record.

## Local runtime and scope

- Current app: `http://127.0.0.1:3030/sandbox`
- Older Docker app: port `3028`; do not use it as current-branch evidence.
- Canonical local scope created for Hermes testing: tenant `demo-tenant`, bank `bank-a`, project `ray-dashboard-test`.
- Hermes configuration is outside this repository and must not be committed: `C:\Users\kafsh\AppData\Local\hermes\config.yaml`.
- Current Hermes proxy variables use `RAY_MEMORY_TENANT_ID=demo-tenant`, `RAY_MEMORY_BANK_ID=bank-a`, `RAY_MEMORY_PROJECT_ID=ray-dashboard-test`, and read/write memory scopes.

## Files most relevant to the next task

- `scripts/hermes-mcp-proxy.mjs` — standard MCP-to-governed-MCP stdio bridge.
- `scripts/hermes-automation-smoke.mjs` — repeatable app-side automation health check.
- `docs/integrations/hermes-automation.example.md` — Hermes cron and evidence contract.
- `docs/integrations/hermes-mcp-command.example.json` — command-mode template.
- `app/api/mcp/route.ts` — MCP route and tool listing/calls.
- `lib/runtime/mcp/service.ts` — retain authorization and validation.
- `lib/runtime/project-dashboard-service.ts` — dashboard snapshot, canonical fact fallback.
- `tests/runtime/mcp-service.test.ts` — MCP retain test.
- `tests/runtime/project-dashboard-service.test.ts` — canonical fact dashboard test.
- `app/sandbox/page.tsx` — dashboard UI and interactive panels.

## Exact first commands for the next chat

From the repository root, first inspect the active state without modifying it:

```powershell
git status --short
npm run typecheck
npx vitest run tests/runtime/mcp-service.test.ts tests/runtime/project-dashboard-service.test.ts --reporter=verbose
npm run hermes:automation:smoke
```

Then open the current dashboard, select `ray-dashboard-test`, and verify it is still on port 3030:

```text
http://127.0.0.1:3030/sandbox
```

If the dashboard server is not already running, start it using the local environment configuration approved for this workspace. Do not paste database credentials into chat, documentation, commits, or logs.

## Automation evidence boundary

`npm run hermes:automation:smoke` directly proves that the governed MCP
automation surface can initialize and answer capture-status, project-state, and
recall requests for the configured project. It does **not** prove that Hermes
cron scheduled or delivered a run. That requires a Hermes terminal result plus
a matching durable dashboard event. At the latest check, `hermes cron list`
was blocked by Hermes' interrupted source update and desktop packaging path;
the repository-side smoke command remained green.

## Recommended next implementation boundary

Build the smallest truthful measurement bridge that records a bounded latency and operation result for successful MCP tool calls, then prove that:

1. an authorized Hermes `memory_recall` or `memory_retain` produces a canonical durable event;
2. the dashboard receives one real telemetry point for the selected project;
3. the latency/runtime-health panels become non-empty without synthetic data;
4. failure and unauthorized paths are shown accurately; and
5. the project, tenant, and bank isolation tests continue to pass.

Keep the four-network mix at zero unless the retained record has a real, evidence-backed type classification.

## Guardrails

- PostgreSQL remains the canonical durable source; browser state is simulation only.
- Every durable mutation needs correlation and idempotency information plus an event-ledger record.
- Preserve tenant, bank, project, conversation/run, agent, and user scope; unknown scope fails closed.
- Keep MCP writes least-privileged and validate all tool arguments server-side.
- Do not edit or commit Hermes user configuration from the repository.
- Do not delete, reset, clean, or overwrite unrelated dirty work.
- Do not claim browser, live connector, benchmark, or production verification beyond the evidence table above.
