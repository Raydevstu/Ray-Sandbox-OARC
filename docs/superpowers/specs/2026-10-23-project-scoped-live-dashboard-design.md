# Project-Scoped Live Dashboard Design

## Intent

Make every Dashboard panel truthful for one authorized project. No Dashboard graph, card, number, event, or visual effect may read the browser seed store, generate a simulated value, or imply a live connection when the scoped server source is unavailable.

## Product contract

The signed-in user selects one project they are permitted to view. Every request carries that project scope and the server verifies it against the JWT `allowed_project_ids` claim before reading or streaming data. Unknown, missing, or unauthorized project IDs return a stable forbidden response; the Dashboard displays `Disconnected` without retaining data from a previously selected project.

The Dashboard distinguishes:

- `Live`: the scoped SSE stream has delivered a snapshot in the last 15 seconds.
- `Stale`: the last valid snapshot is older than 15 seconds.
- `Disconnected`: authorization, connection, configuration, or server failure prevents a valid scoped snapshot.
- `Empty`: the project is authorized but has no durable records or observed operations. Empty is not a failure and uses zero/empty visual states, never seeded sample data.

## Runtime data model

`ProjectDashboardSnapshot` is the single API response and SSE event shape. It is produced from two server-owned sources:

1. `ProjectRuntimeMetricsRegistry`, a bounded, in-process ledger partitioned by `{ tenantId, bankId, projectId }`. It records retain, recall, MCP, queue, worker, and request-stage observations, including timestamp, duration, outcome, operation, app/consumer, and MCP tool name. It contains metadata only: no request text, JWT, secret, or unredacted tool arguments.
2. `CanonicalRepository`, queried under the same scope for durable project memory and append-only project events. It supplies network distribution, event stream, memory count, confidence summary, and durable per-project activity. PostgreSQL remains canonical in production; a local test double remains test-only.

The snapshot contains project identity, generated time, connection freshness, operations, error/success counts, latency percentile and named stage timings, queue state, MCP tool counts, per-app health, four-network distribution, confidence summary, durable event summaries, and bounded time series. It does not invent values for unavailable measurements; each field has `measured`, `empty`, or `unavailable` state.

## Panel mapping

| Dashboard panel | Server-backed source | Empty/unavailable behavior |
|---|---|---|
| KPI cards | snapshot aggregates and durable project counts | `—` plus reason, never seed sparklines |
| Operations timeline / live retrieval | scoped operation series | real points only; empty timeline if none |
| Four-network mix | canonical project memory records by network | zero slices with empty explanation |
| Latency trend / recall structure | measured request and stage timings | `Not measured yet` for absent stages |
| Retrieval mix | durable project memory category totals | zero/empty visual only |
| Runtime health / app health | observed app/consumer outcomes and freshness | no app row until observed |
| Queue pressure | dispatcher/worker queue snapshots | zero only when measured; otherwise unavailable |
| Event stream | append-only project event ledger | scoped empty state |

## API and authorization

`GET /api/project-dashboard?projectId=<id>` returns a scoped snapshot. `GET /api/project-dashboard/stream?projectId=<id>` sends the initial snapshot and updated snapshots by SSE. Both authenticate, verify `memory:read`, verify tenant/bank, and enforce the JWT project allow-list on the server.

The existing local-only `/api/runtime-metrics` endpoint remains an unscoped development diagnostic and is not used by the project Dashboard after this slice. It must not be exposed as a production data path.

## Visual and interaction design

The visual base uses the existing React/Tailwind component system, with reusable accessible patterns inspired by Shadcn-style Cards, Tabs, Tooltips, Tables, Selects, Dialogs, and Skeletons. No external copied component code enters the repository without license and review verification.

Each card has an accessible table alternative, keyboard controls, visible focus, and a textual state/status. Visual effects use the snapshot status only:

- CSS/SVG depth: status glow, animated edges, and signal particles for `Live` only.
- Optional 3D scene: a compact React Three Fiber project topology/map renders only provided network, operation, and queue values. It must have a deterministic SVG/static fallback, lazy loading, no text-only information hidden in the canvas, and no animation under `prefers-reduced-motion: reduce`.
- TanChat is excluded: its access page states it is early alpha, and chat UI is not required to make the dashboard live.

The performance gate is: no continuous 3D rendering while the tab is hidden; reduced-motion disables animation; a 375px mobile view renders the SVG fallback; and rendering must not delay receipt or display of a valid snapshot.

## Security and privacy

- `allowed_project_ids` is required for project-scoped production requests.
- A project switch clears old snapshot state before connecting to the new project.
- Aggregate cross-project metrics are prohibited.
- Server telemetry never persists content, secrets, raw JWTs, or raw tool arguments.
- All durable reads follow tenant, bank, and project scope.

## Acceptance evidence

- IMPLEMENTED: typed project claim, project registry, dashboard aggregation service, protected snapshot/SSE routes, client subscription, and every panel mapping exist.
- TESTED: authorization failures, cross-project rejection, empty/unavailable states, live/stale/disconnected transitions, metric derivation, queue and stage timing behavior, visual fallback, reduced motion, and keyboard/table alternatives pass automated tests.
- LOCALLY VERIFIED: authorized project operations change the scoped snapshot and a real browser receives the update.
- BROWSER VERIFIED: authenticated project switch and all dashboard panels pass at 375/768/1440 with serious/critical axe checks.
- Not claimed: production deployment, multi-process aggregation, external-provider telemetry, or a live connector until separately exercised.
