# Hindsight Sandbox / Ray Memory Hub

**Open-source (MIT) Next.js App Router workspace and local agent-memory hub** inspired by [hindsight.vectorize.io](https://hindsight.vectorize.io/) and the Hindsight technical report.

This repository includes:
- a **browser sandbox/workspace** (memory, prompt, context, learning, orchestration, benchmarks, etc.) that can run without external backend services;
- an optional **PostgreSQL-backed runtime/hub** with authenticated APIs, capture/import, distillation, scoped recall, sweeper/operations surfaces, and dashboard observability (SECOND-BRAIN).

> **Evidence-first note:** a route returning HTTP 200 is not proof of end-to-end connector correctness. Verify scope, capture status, traces, and recall visibility for the same tenant/bank/project.

---

## Quick start

### A) Local runtime hub (recommended for capture/import/recall/sweeper)
```powershell
# from repo root
docker compose up -d --build
docker compose ps
```
- App/UI: `http://127.0.0.1:3018` (sandbox dashboard: `/sandbox`)
- Postgres: `127.0.0.1:5434` (internal `5432`)

Verify:
```powershell
curl.exe -sS http://127.0.0.1:3018/api/project-memory/status
# expect ok:true and data.storeMode:"postgres" (after healthy startup)
```

Seed/backfill (idempotent) and smoke-check wiring:
```powershell
node scripts/ray-backfill.mjs
node scripts/ray-automation-smoke.mjs --local
```

### B) UI/sandbox dev mode (Node)
```powershell
npm install
npm run dev   # http://localhost:3000
```
Use this for UI development. For the full Postgres-backed runtime behavior, use the compose/runtime setup and configured env vars.

---

## Setup, wiring, and usage

### 1) Runtime configuration (local compose)
`docker-compose.yml` (local) configures the app with:
- `APEX_DATABASE_URL` (Postgres)
- local dev auth flags (`APEX_ALLOW_DEV_PRINCIPAL=true`, `APEX_REQUIRE_JWT=false`) — **local dev only**
- audit/admin scope envs for operations/sweeper surfaces:
  - `APEX_AUDIT_TENANT_ID=sandbox-tenant`
  - `APEX_AUDIT_BANK_ID=secondbrainog`
  - `APEX_AUDIT_PROJECT_ID=SECOND-BRAIN`

Rebuild/redeploy after env or code changes:
```powershell
docker compose up -d --build app
```

### 2) Core memory hub flow
1. **Import/capture** conversation events (`POST /api/project-memory/import`, strict scoped envelope).
2. **Normalize/persist/queue** events into project memory pipeline.
3. **Distill to canonical facts** (import bridge, idempotent) so recall can surface imported/backfilled content.
4. **Recall** scoped distilled facts (`POST /api/v1/memory/recall`) for the same `tenantId/bankId/projectId`.
5. **Observe/operate** via status, operations, sweeper, and dashboard SECOND-BRAIN card.

### 3) Key endpoints
- `GET  /api/project-memory/status` — capture state, client relay, sweeper status, store mode
- `POST /api/project-memory/import` — scoped conversation import (strict envelope)
- `POST /api/v1/memory/recall` — scoped recall over canonical distilled facts
- `GET  /api/project-memory/operations` — jobs/capture/sweeper/derived ops status (scoped auth)
- `GET|POST /api/project-memory/sweeper-run` — sweeper status/run

Contracts: `docs/contracts/import.json`, `docs/contracts/recall.json`, `docs/contracts/status.json`

### 4) Example: scoped recall (local dev-principal mode)
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

### 5) Wiring clients/capture (Hermes, OpenCode, Codex, MCP-capable editors)
- Start **read-only** (`memory_recall`, `memory_trace`, project state, capture status), then enable writes with explicit approval/audit.
- Use **scoped credentials** (never DB/provider secrets as agent tokens).
- Verify **same-scope recall visibility** (distilled facts), not just import acceptance.
- Client status relay files (host): `%LOCALAPPDATA%\ray-memory\status\<platform>.json` (surfaced by status/dashboard when readable).

Integration templates/examples:
- `docs/integrations/hermes-mcp-command.example.json`
- `docs/integrations/hermes-mcp-readonly.example.yaml`
- `docs/integrations/opencode-mcp-readonly.example.json`
- `docs/HOW-TO-GUIDE.md` (detailed setup/wiring/usage/troubleshooting)

---

## Features & functions

### Memory hub/runtime (SECOND-BRAIN)
- **Capture/import:** strict envelope, scoped auth, idempotent conversation identity.
- **Import → distill → facts bridge:** accepted imports distilled into canonical `facts` for recall visibility.
- **Scoped recall:** recall over canonical distilled facts with server-side scope enforcement/resolution.
- **Status/observability:** `/api/project-memory/status` and dashboard SECOND-BRAIN card (capture states, client relay, sweeper, store mode, links).
- **Retention sweeper:** soft-delete/purge lifecycle for aged raw data with grace period; distilled facts exempt; manual/status endpoints.
- **Operations/audit surfaces:** job/health/capture/sweeper visibility for evidence-driven debugging.

### Sandbox/workspace apps (UI)
| App | Route | Purpose |
|---|---|---|
| **Dashboard** | `/sandbox` | Fleet/runtime view + SECOND-BRAIN status card and telemetry surfaces |
| **Memory** | `/sandbox/memory` | Retain/browse/graph/recall/reflect workflows and inspection |
| **Prompt Studio** | `/sandbox/prompts` | Prompt/version/test and disposition-aware prompt composition |
| **Context Tuning** | `/sandbox/context` | Retrieval/context tuning controls and previews |
| **Continuous Learning** | `/sandbox/learning` | Memory maintenance/learning-loop simulation |
| **Orchestrator** | `/sandbox/orchestrator` | Node-graph app wiring and pipeline runs |
| **Evaluation** | `/sandbox/eval` | Benchmark/eval harness views and comparisons |
| **Benchmarks** | `/sandbox/benchmarks` | Published benchmark visualizations |
| **Integrations** | `/sandbox/integrations` | Integration/config surfaces and examples |
| **Settings** | `/sandbox/settings` | Theme/customization/workspace controls |
| **Docs & Guides** | `/sandbox/docs` | In-app setup, wiring, usage, features, troubleshooting |

(Feature depth varies by sandbox simulation vs runtime-backed paths; verify claims against runtime evidence where needed.)

---

## Troubleshooting

### `GET /api/project-memory/operations` or `POST /api/project-memory/sweeper-run` returns 503/not configured
- Ensure `APEX_DATABASE_URL` is set and Postgres is reachable.
- Ensure `APEX_AUDIT_TENANT_ID` and `APEX_AUDIT_BANK_ID` are configured for admin-scoped routes.
- Rebuild/redeploy after env changes (`docker compose up -d --build app`).

### Recall returns no imported/backfilled memories
- Confirm import `imported/accepted` succeeded for the same scope.
- Confirm deployment includes the import→distill→facts bridge.
- Re-run idempotent backfill: `node scripts/ray-backfill.mjs`.
- Query with matching `tenantId/bankId/projectId` and targeted terms.

### Import returns `403 scope denied`
- Check auth headers/scopes and tenant/bank/project consistency.
- Validate `workspacePath` hints; known cross-project/tampered mappings are rejected by design.

### `storeMode` is `degraded` or `not_configured`
- `not_configured`: store URL/config missing.
- `degraded`: store configured but unhealthy/unreachable from app.
- Inspect DB/container health, logs, and env configuration.

### `clientStatuses` empty in status/dashboard
- Status relay reads local host status files (`%LOCALAPPDATA%\ray-memory\status\<platform>.json` on Windows). Containerized app may not see host-local files unless mounted/relayed.

### Playwright e2e webServer/dev startup fails
- `playwright.config.ts` starts `next dev -p 3000` (reuse existing server). Some local environments hit dev/watchpack/module-resolution issues; run in a healthy dev environment or target an already-running server with adjusted config.

### Operations shows degraded/active failures
- Often reflects honest runtime/job state (pending jobs, historical errors), not endpoint misconfiguration. Inspect the operations payload and logs.

---

## Useful scripts
- `node scripts/ray-backfill.mjs` — idempotent design backfill/import
- `node scripts/ray-automation-smoke.mjs --local` — CI-safe wiring/artifact checks
- `npm run typecheck` / `npm test` — static checks and test suite
- `npm run db:migrate:postgres`, `npm run smoke:postgres` — DB/migration/smoke helpers
- `npm run hermes:automation:smoke` — Hermes automation smoke (environment-dependent)

## Documentation
- **In-app:** `http://127.0.0.1:3018/sandbox/docs`
- **How-to guide:** `docs/HOW-TO-GUIDE.md`
- **Design/spec & evidence:** `docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md`
- **Contracts:** `docs/contracts/*.json`
- **Integrations:** `docs/integrations/*`
- **Additional references:** `docs/fusion-guide.md`, `docs/mem0-evaluation.md`, `docs/evidence-matrix.md`

## Architecture (high level)

```
app/                      # Next.js App Router (landing + sandbox + API routes)
components/               # UI, charts, memory/orchestrator components, shell
lib/
  engine/                 # retrieval/distillation/lifecycle/scoring logic
  runtime/                # runtime contracts, auth, repositories, pipeline, store adapters
  server/                 # server-side helpers (pg client/lifecycle, sweeper, watcher, etc.)
  data/                   # seed datasets and benchmarks
scripts/                  # backfill/smoke/migrations/benchmarks/ops helpers
db/migrations/            # PostgreSQL schema migrations
docs/                     # guides, contracts, specs, evidence, integrations
```

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand, PostgreSQL (`pg`), Zod. Some charts/canvas views are dependency-free SVG implementations.

## Sources & inspiration
| Source | Used for |
|---|---|
| [Hindsight Technical Report (arXiv:2512.12818)](https://arxiv.org/abs/2512.12818) | Four-network memory framing, retain/recall/reflect concepts, retrieval/ranking ideas |
| [ACL 2026 demo (2026.acl-demo.27)](https://aclanthology.org/2026.acl-demo.27/) | System/demo framing |
| [hindsight.vectorize.io](https://hindsight.vectorize.io/) | UI/interaction inspiration and documented behavior concepts |
| [UMA (arXiv:2602.18493)](https://arxiv.org/abs/2602.18493) | Continuous learning concepts referenced in sandbox experiences |
| [Agent Memory systems characterization (arXiv:2606.06448)](https://arxiv.org/abs/2606.06448) | Benchmark characterization context |

This project is **not affiliated with Vectorize.io**. It re-implements/re-presents concepts and published figures for study and experimentation with original code and copy where applicable. Upstream production system: [github.com/vectorize-io/hindsight](https://github.com/vectorize-io/hindsight).

## License
MIT — see [LICENSE](./LICENSE).
