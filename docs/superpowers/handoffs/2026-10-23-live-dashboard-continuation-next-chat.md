# Ray Sandbox OARC — Live Dashboard Continuation Handoff

Date: 2026-10-23

Project: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`

Branch: `renewal-roadmaps`

## Start here

This is a continuation handoff for the project-scoped live Dashboard. The current worktree is intentionally dirty and contains broad user-owned changes from earlier slices. Preserve all unrelated edits, `.firecrawl/`, and `test-results/`. Do not reset, clean, delete, move, overwrite unrelated files, or commit unless the user explicitly authorizes it.

Rollback reference: branch `codex/backup-live-dashboard-2026-10-23`, commit `0d24489`.

Read in this order:

1. `AGENTS.md`
2. `docs/superpowers/PROJECT-CORE-HEART.md`
3. `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`
4. `docs/superpowers/plans/2026-10-23-project-scoped-live-dashboard.md`
5. `docs/superpowers/specs/2026-10-23-project-scoped-live-dashboard-design.md`
6. This handoff

## User goal

Keep the Dashboard visually rich and interactive, but make every value truthful: all panels must come from one authorized project’s server records. The visual layer should use animated charts and the accessible SVG/depth topology fallback, while respecting reduced-motion settings. Do not restore browser-seeded numbers merely to make the screen look populated.

## Current implementation

### IMPLEMENTED

- Local development owner session through `POST /api/auth/session` with `{ "mode": "local-owner" }` when development principals are enabled.
- Server-side project authorization using the authenticated principal’s tenant, permissions, and `allowedProjectIds`.
- Protected snapshot route: `GET /api/project-dashboard?bankId=...&projectId=...`.
- Protected SSE route: `GET /api/project-dashboard/stream?bankId=...&projectId=...`.
- Project metrics registry/service in:
  - `lib/runtime/project-dashboard-metrics.ts`
  - `lib/runtime/project-dashboard-service.ts`
- Dashboard client in `app/sandbox/page.tsx` now uses snapshot fetch, SSE, and five-second polling.
- Dashboard status labels: `Live`, `Stale`, and `Disconnected`.
- Rich live panels currently rendered from the project snapshot:
  - KPI cards for memories, operations, failures, graph links, recall p50, and queue state.
  - Project operations timeline.
  - Four-network mix and confidence.
  - Live retrieval telemetry with pause, zoom, reset, and table controls.
  - Runtime health.
  - Latency structure.
  - Animated accessible SVG/depth topology in `components/oarc-v2/project-runtime-topology.tsx`.
  - Scoped event stream.
- The Dashboard does not expose JWTs to React storage or browser local storage.

### TESTED

The following passed in the current continuation:

```text
npm run typecheck
10 focused runtime tests across:
  tests/runtime/browser-session.test.ts
  tests/runtime/project-dashboard-route.test.ts
  tests/runtime/project-dashboard-metrics.test.ts
  tests/runtime/project-dashboard-service.test.ts

2 browser tests:
  tests/e2e/live-dashboard.spec.ts
  tests/e2e/project-dashboard.spec.ts
```

### BROWSER VERIFIED

The real local browser at `http://127.0.0.1:3030/sandbox` showed:

- `Live`
- `Bank ID: bank-a`
- `Project: RayBots`
- `Operations timeline`
- `Four-network mix`
- `Live retrieval telemetry`
- `Runtime health`
- `Latency structure`
- `Project runtime topology`
- `Status: live`
- `Event stream`

The current RayBots project has no durable operation samples, so empty/zero values are expected. The telemetry chart can show `Stale` when no new operation sample arrives even while the project stream connection itself is `Live`. This is honest state, not a connection failure.

## Main remaining issue

The Dashboard was visually richer before the seed-panel replacement. The current implementation restores the core rich live layout, but it intentionally does not restore old synthetic panels or fake history. The following old content is not yet represented by canonical project-backed fields:

- App health fleet rows and per-app sparklines.
- Tokens stored KPI.
- Graph-link count, unless a canonical project graph count is available.
- Queue details beyond the fields currently exposed by the runtime snapshot.
- Per-stage latency values when no measured stage samples exist.
- A populated long-range timeline when the project has no recorded operations.

Do not fill these with constants, browser seed data, or random animation. Either add the real server-derived fields or render an explicit `Unavailable` / `No data yet` state.

## Exact next implementation boundary

Continue only this vertical slice:

1. Inspect the canonical PostgreSQL schema/repository for real project-level graph counts, token usage, queue state, app health, and stage latency records.
2. Extend `ProjectDashboardSnapshot` and the service only with fields that can be derived from those records under the exact tenant/bank/project scope.
3. Add failing focused tests first for each new field, including empty and unavailable states.
4. Bind the corresponding Dashboard panels to those fields.
5. Keep existing interactive chart controls and SVG topology. Do not add React Three Fiber unless a separate performance/accessibility gate is approved; SVG/CSS is already the intended shipped fallback.
6. Add/extend browser coverage at 375px, 768px, and 1440px for live, empty, stale, disconnected, reduced-motion, keyboard focus, and table fallback behavior.
7. Re-run focused runtime tests, typecheck, and the two Dashboard browser tests before claiming completion.

## Important runtime facts

- Port `3030` is the newer local Next development runtime used for current browser verification.
- Port `3028` is the older Docker app instance and may show the previous seeded dashboard. Do not use it as current evidence for this branch.
- Local PostgreSQL is exposed by Docker at host port `5443`.
- The verified local development process was started with:

```text
APEX_DATABASE_URL=postgresql://staging:staging_local_only@127.0.0.1:5443/ray_sandbox_staging
APEX_ALLOW_DEV_PRINCIPAL=true
```

- The local-owner session is development-only. Production must use configured JWT issuer/JWKS authentication with `APEX_REQUIRE_JWT=true`.

## Evidence limits

- `IMPLEMENTED`: protected project snapshot/SSE path, rich live UI, animated SVG topology, and local owner session exist.
- `TESTED`: focused runtime and browser tests listed above passed.
- `LOCALLY VERIFIED`: the local PostgreSQL/Docker-backed runtime and local browser path were exercised.
- `LIVE CONNECTOR VERIFIED`: not claimed; no external Hermes/OpenCode connector delivery is proved by this dashboard work.
- `PRODUCTION VERIFIED`: not claimed.
- Real non-empty dashboard graphs still require actual authorized RayBots operations to be recorded in canonical PostgreSQL.

## Do not lose these invariants

- Unknown project scope fails closed.
- Never expose or log JWTs, private keys, raw secrets, or unredacted customer content.
- A project switch must clear the old snapshot before opening the next stream.
- Missing measurements are `Unavailable`, not zero milliseconds.
- Empty projects stay visibly empty.
- Visual animation reflects actual runtime state and pauses/degrades for reduced motion or hidden tabs.
- Preserve the dirty worktree and do not commit unless explicitly requested.

## Recommended first command

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
git status --short
rg -n "ProjectDashboardSnapshot|networkMix|queue|stage|token|graph|app health|App health" lib app tests components
```

Then inspect the canonical repository/service before editing. The next chat should begin by stating which additional real PostgreSQL fields exist and which requested panels must remain explicitly unavailable.
