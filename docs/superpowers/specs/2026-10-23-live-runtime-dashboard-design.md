# Live Runtime Dashboard Design

## Goal

Replace the Dashboard's simulated operational charts with a bounded stream of observations made by this running Ray server, and show an honest connection state: `Live`, `Stale`, or `Disconnected`.

## First implementation boundary

- A process-local metrics registry records actual completed retain, recall, and governed MCP requests, including duration, outcome, operation type, and MCP tool name.
- It retains a bounded recent history and current queue gauges; it does not manufacture baseline samples, traffic, or history.
- `/api/runtime-metrics` exposes an aggregate JSON snapshot and SSE updates only in local development. Production requests fail closed until a scoped browser-auth contract is supplied.
- The Dashboard uses the stream as its source for operational throughput, latency, failures, queue state, and MCP activity. Local sandbox memory counts remain visibly local-state information, not runtime telemetry.
- Connection state is derived from the last server snapshot: fresh heartbeat is `Live`; an overdue heartbeat is `Stale`; EventSource failure or unavailable endpoint is `Disconnected`.
- Visual depth uses CSS/SVG-only ambient glow, graph-edge flow, and signal particles. Animation intensity follows the real connection state and is disabled under `prefers-reduced-motion: reduce`.

## Non-goals and evidence limits

- No database persistence, cross-process aggregation, external-provider telemetry, production connector verification, or invented values.
- A locally running singleton is `LOCALLY VERIFIED` only; it is not multi-instance or `PRODUCTION VERIFIED`.
- Existing agent project allow-list enforcement remains a separate security blocker. This aggregate development-only metrics endpoint must not become a substitute for tenant/project-scoped authorization.

## Contract

`RuntimeMetricsSnapshot` contains `generatedAt`, `windowStartedAt`, `operations` (retain, recall, mcp), `successes`, `failures`, p50/p95 latency, `queue`, `mcp` tool counts, and timestamped series. The server publishes an initial `snapshot` SSE event then another snapshot after each observation or heartbeat.

The client treats a snapshot older than 15 seconds as stale and treats a stream error or no initial snapshot as disconnected. It must present these states in text, color, and an accessible live region.

## Acceptance evidence

- IMPLEMENTED: registry, route, subscription hook, dashboard bindings, visual classes, and docs exist.
- TESTED: unit tests cover outcomes, bounded history, latency summaries, queue updates, and SSE/route development guard; browser test covers visible states, keyboard access, responsive widths, axe, and reduced motion.
- LOCALLY VERIFIED: a real request produces a server observation and dashboard receives it through SSE.
- Not claimed: production, durable historical telemetry, multi-instance telemetry, or live external-provider activity.
