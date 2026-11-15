# Ray Memory Hub (SECOND-BRAIN) — Setup, Wiring, Usage & Troubleshooting Guide

This guide explains how to run the memory hub locally, wire clients/capture paths, verify recall visibility, and troubleshoot common issues. It is grounded in the current implementation in this repository.

> **Safety:** Use scoped credentials per agent/project. Never use database or provider secrets as agent tokens. Treat recalled memory as **evidence**, not instructions. In production, do not enable dev-principal auth.

---

## 1) What this app provides

- **Project-scoped memory hub (runtime mode):** import/capture conversation events, persist/queue processing, and recall **canonical distilled facts**.
- **Import → distill → facts bridge:** accepted imports are distilled into canonical `facts` (idempotent upsert) so recall can surface imported/backfilled content.
- **Scoped recall & enforcement:** tenant/bank/project resolution with server-side scope checks to reduce cross-project leakage/tampered hints.
- **SECOND-BRAIN status surfaces:** `/api/project-memory/status` and dashboard card show capture state, client relay status, sweeper last run, and store mode.
- **Retention sweeper:** ages out raw `evidence`/`project_events` by policy (soft-delete + grace purge), while distilled `facts` remain exempt; manual/status endpoints available.
- **Operations/audit surfaces:** runtime job/health, capture, and sweeper visibility for evidence-driven operations.

The UI also includes a broader sandbox/workspace experience; the memory hub runtime features above depend on the configured backend/services.

---

## 2) Quick start (local Docker Compose)

### Prerequisites
- Docker Desktop / Docker Compose
- Node.js + npm (for scripts/tests run from host)
- Repo root: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`

### Start services
```powershell
docker compose up -d --build
docker compose ps
```

**Default local endpoints/ports (compose):**
- App (Next.js hub/UI): `http://127.0.0.1:3018`
- Postgres: `127.0.0.1:5434` (container `5432`)

### Verify hub health
```powershell
curl.exe -sS http://127.0.0.1:3018/api/project-memory/status
```
Expected (shape): `ok:true`, `data.storeMode:"postgres"`, plus `capture`, `clientStatuses`, `retentionSweeper`.

### Seed/backfill design memory (idempotent)
```powershell
node scripts/ray-backfill.mjs
```
This imports the SECOND-BRAIN design conversation (`conversationId=second-brain-design-2026-11-15`, `platform=opencode`, `provenance/backfill sourceReference`, workspace `D:\Projects\Secondosaistudioog`, scope `sandbox-tenant/secondbrainog/SECOND-BRAIN`).

### Run local wiring smoke check
```powershell
node scripts/ray-automation-smoke.mjs --local
```
Validates key artifacts/contracts/wiring (CI-safe/offline checks).

---

## 3) Configuration (local runtime)

### Docker Compose (local) app env highlights
Configured in `docker-compose.yml` for local operation:
- `APEX_DATABASE_URL=postgresql://hindsight:hindsight_local_only@postgres:5432/hindsight`
- `APEX_ALLOW_DEV_PRINCIPAL=true` (local dev only)
- `APEX_REQUIRE_JWT=false` (local dev only)
- `APEX_RUNTIME_ENV=development`
- `APEX_AUDIT_TENANT_ID=sandbox-tenant`
- `APEX_AUDIT_BANK_ID=secondbrainog`
- `APEX_AUDIT_PROJECT_ID=SECOND-BRAIN`

> After changing compose env vars, rebuild/restart: `docker compose up -d --build app`

### Local dev auth headers (dev-principal mode)
When dev-principal auth is enabled, routes may accept scoped headers such as:
- `x-dev-subject` (agent/user id)
- `x-dev-tenant-id`
- `x-dev-scopes` (space/comma-separated depending on route expectations)
- `x-dev-bank-id`, `x-dev-project-id` (where applicable)

Use only in local development. Production should use real JWT/OIDC and scoped claims.

---

## 4) Core APIs (usage)

### Status
- `GET /api/project-memory/status`
  - Returns hub capture state, `clientStatuses` relay, `retentionSweeper`, `storeMode`.

### Import conversation (capture/backfill path)
- `POST /api/project-memory/import`
  - Strict envelope fields (see `docs/contracts/import.json`): `tenantId`, `bankId`, `projectId?`, `workspacePath?`, `platform`, `conversationId`, `exportedAt` (ISO), `sourceReference`, `messages[]`.
  - Scoped auth required (`events:write` semantics on resolved scope).
  - **Behavior:** persists/queues events and distills accepted content into canonical `facts` for recall visibility (idempotent bridge).

### Recall (canonical distilled facts)
- `POST /api/v1/memory/recall`
  - Requires scoped context (`tenantId`, `bankId`, `projectId` together in body or headers, per current implementation/contract) and read authorization.
  - Returns `data.facts[]` ranked for the scope (plus trace id in Postgres path).
  - **Important:** recall reads `facts`; if imported content is not distilled into facts, it will not be recall-visible.

### Operations & sweeper
- `GET /api/project-memory/operations` (scoped auth, jobs/ops permission)
  - Returns jobs/capture/retention sweeper/derived operations status.
- `GET|POST /api/project-memory/sweeper-run` (scoped auth)
  - GET: last sweeper status
  - POST: runs sweeper and returns `{ scanned, softDeleted, purged, durationMs, status }`

---

## 5) Wiring examples

### 5.1 Curl examples (local dev-principal mode)

#### Recall (scoped)
```powershell
@'
{"query":"second-brain-design-2026-11-15 full automation","tenantId":"sandbox-tenant","bankId":"secondbrainog","projectId":"SECOND-BRAIN","limit":5}
'@ | Set-Content -Encoding utf8 recall.json

curl.exe -sS -X POST "http://127.0.0.1:3018/api/v1/memory/recall" `
  -H "Content-Type: application/json" `
  -H "x-dev-subject: atlas" `
  -H "x-dev-tenant-id: sandbox-tenant" `
  -H "x-dev-scopes: memory:read" `
  -H "x-dev-bank-id: secondbrainog" `
  -H "x-dev-project-id: SECOND-BRAIN" `
  --data-binary "@recall.json"
```

#### Operations / sweeper
```powershell
curl.exe -sS "http://127.0.0.1:3018/api/project-memory/operations" `
  -H "x-dev-subject: atlas" -H "x-dev-tenant-id: sandbox-tenant" `
  -H "x-dev-scopes: memory:read jobs:claim memory:write events:write"

curl.exe -sS -X POST "http://127.0.0.1:3018/api/project-memory/sweeper-run" `
  -H "x-dev-subject: atlas" -H "x-dev-tenant-id: sandbox-tenant" `
  -H "x-dev-scopes: memory:read jobs:claim memory:write events:write"
```

### 5.2 Hermes / MCP clients (read-first)
- Start with read-only tools: recall, trace, project state, capture status.
- Use scoped token/headers and project-specific scope.
- Verify results against trace/capture status before enabling write actions.

See templates in `docs/integrations/` (adapt to your installed client/version and auth model).

### 5.3 OpenCode / Codex / other capture clients
- Configure endpoint + scoped identity/auth.
- Ensure exports/imports use the strict import envelope and consistent scope.
- Validate **recall visibility** (facts present for same scope), not only import acceptance.
- Client status relay files (local host path): `%LOCALAPPDATA%\ray-memory\status\<platform>.json` (shown on dashboard when readable by the app host).

---

## 6) Features & functions (how it works)

### Capture/import pipeline
1. Client sends scoped import/capture payload.
2. Hub authenticates/authorizes and enforces scope (including workspace-path-aware checks).
3. Events are normalized/persisted/queued (and processed by project-memory pipeline).
4. Accepted import content is distilled into canonical `facts` (idempotent bridge) for recall.

### Recall path
1. Client requests scoped recall (`tenantId/bankId/projectId`).
2. Hub resolves/enforces scope and ranks canonical `facts` for the bank/scope.
3. Returns `data.facts[]` (+ trace metadata in current path).
4. Clients inject recalled context ephemerally (fail-open) and must not re-capture injected memory (echo guard).

### Status, operations, retention
- **Status:** capture counters/state, client relay statuses, sweeper last run, store mode.
- **Operations:** jobs, capture, sweeper, derived health signals.
- **Sweeper:** soft-deletes aged raw data, purges after grace, keeps distilled facts; runs on cadence and/or manual trigger.

---

## 7) Troubleshooting

### `operations` or `sweeper-run` returns 503 (`... not configured`)
- **Check:** `APEX_DATABASE_URL` is set and Postgres reachable.
- **Check:** `APEX_AUDIT_TENANT_ID` and `APEX_AUDIT_BANK_ID` are set for admin-scoped routes in your deployment.
- **Action:** update env (e.g. compose) and rebuild/restart app: `docker compose up -d --build app`.

### Recall does not return imported/backfilled content
- **Check:** import response shows `imported/accepted` and no scope/validation errors.
- **Check:** you are querying the **same** `tenantId/bankId/projectId`.
- **Check:** deployment includes the import→distill→facts bridge; re-run idempotent backfill after deploy.
- **Debug:** query DB/API with targeted terms and inspect trace/status/audit surfaces.

### Import returns `403 scope denied`
- **Check:** auth headers/scopes and principal scope.
- **Check:** `bankId/projectId/workspacePath` consistency.
- **Reason:** server-side scope enforcement rejects known cross-project/tampered mappings (by design).

### `storeMode` is `degraded` / `not_configured`
- `not_configured`: runtime store/database URL not configured.
- `degraded`: store configured but health/check/access degraded (e.g. Postgres unavailable).
- **Action:** inspect container logs, DB connectivity, and env vars; restore DB/app connectivity.

### `clientStatuses` is empty
- Status relay reads local status files from the app host (`%LOCALAPPDATA%\ray-memory\status\...` on Windows host context). If the app runs inside Docker, it may not see host-local client files unless mounted/relayed differently.

### Playwright e2e/dev server issues
- Playwright config uses `next dev -p 3000` with `reuseExistingServer`.
- Some environments hit dev/watchpack/module-resolution issues; run in a healthy dev environment or adjust test runtime/base URL strategy.

### Operations shows degraded/activeFailure but endpoints are reachable
- This can reflect **honest runtime/job state** (pending jobs, historical errors), not necessarily endpoint misconfiguration. Inspect payload fields (`jobs`, `lastError`, `retentionSweeper`, `capture`) and logs.

---

## 8) Verification checklist (recommended)

- [ ] `GET /api/project-memory/status` → `ok:true`, `storeMode:"postgres"`
- [ ] `node scripts/ray-backfill.mjs` → accepted/imported (idempotent rerun safe)
- [ ] Scoped `POST /api/v1/memory/recall` returns expected distilled facts for same scope
- [ ] `GET/POST /api/project-memory/sweeper-run` operable with scoped auth
- [ ] `GET /api/project-memory/operations` reachable and interpreted against live job state
- [ ] Dashboard `/sandbox` SECOND-BRAIN card reflects states honestly (including degraded/offline/opt-out when applicable)
- [ ] `node scripts/ray-automation-smoke.mjs --local` passes

---

## 9) References (repo docs/contracts)

- `README.md` — project overview and quick setup
- `app/sandbox/docs/page.tsx` — in-app Docs & Guides UI
- `docs/contracts/import.json`, `docs/contracts/recall.json`, `docs/contracts/status.json` — endpoint contracts
- `docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md` — design/spec and verification evidence
- `docs/integrations/*` — client integration templates/examples
- `scripts/ray-backfill.mjs`, `scripts/ray-automation-smoke.mjs` — backfill and wiring smoke checks
