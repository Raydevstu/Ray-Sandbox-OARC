# Ray Sandbox OARC — Project Memory Runtime Handoff

Date: 2026-10-08  
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`  
Product: Ray Sandbox OARC  
Active branch: verify with `git status --short --branch` before continuing

## Start here

Read these documents first:

- `docs/superpowers/specs/2026-10-07-v2-ui-design-implementation-blueprint.md`
- `docs/superpowers/handoffs/2026-10-07-ray-sandbox-oarc-v2-handoff.md`
- this handoff

The current implementation boundary is the V2.6 project-memory runtime. The app is currently launched from this checkout at:

- `http://localhost:3017/sandbox`
- `http://localhost:3017/sandbox/context`

The development server is running in the prior session on port `3017`. Verify it before relying on it; if it is stopped, launch from the nested repository with `$env:PORT='3017'; npm run dev`.

## What is implemented

The project-memory implementation now includes:

- typed canonical `ConversationEvent` and `ProjectMemoryRecord` contracts;
- PostgreSQL migrations for canonical memory, tombstones, project memory, and durable worker jobs/checkpoints;
- Codex/MCP/session ingestion with deterministic event IDs and source references;
- repository, test, build, runtime-health, and browser-evidence ingestion;
- extraction/classification for decisions, requirements, tests, risks, blockers, and follow-ups;
- provenance, confidence, deduplication, supersession, conflict, and invalidation governance;
- bounded asynchronous dispatch and persistent worker/job processing;
- retry, dead-letter, lease, checkpoint, and telemetry support;
- cross-platform import adapters where an export/connector is available;
- project-memory audit data and explicit empty-state behavior;
- Tier 1 golden-project and with-memory/without-memory benchmark support;
- wiring from Codex/MCP and evidence ingestion entry points into `ProjectMemoryPipeline.enqueue()` while retaining asynchronous latency boundaries.

Important implementation files include:

- `lib/runtime/project-memory-pipeline.ts`
- `lib/runtime/project-worker.ts`
- `lib/runtime/project-memory-dispatch.ts`
- `lib/runtime/repositories/interfaces.ts`
- `lib/runtime/repositories/postgres.ts`
- `lib/runtime/codex-ingestion.ts`
- `lib/runtime/evidence-ingestion.ts`
- `lib/runtime/memory-governance.ts`
- `lib/runtime/memory-audit.ts`
- `db/migrations/0002_postgres_canonical_memory.sql`
- `db/migrations/0003_memory_tombstones.sql`
- `db/migrations/0004_project_memory.sql`
- `db/migrations/0005_project_worker.sql`

## Latest hardening completed

The in-memory queue loop was replaced for the persistent path with a PostgreSQL-backed claim/process/complete cycle. The PostgreSQL claim uses row locking and `FOR UPDATE SKIP LOCKED`; leases can expire and be reclaimed; successful jobs advance checkpoints; failures retry with persisted state and eventually enter dead-letter state.

Restart/recovery integration coverage was added for:

1. two workers not claiming the same job;
2. expired lease reclamation;
3. retry and dead-letter state surviving fresh repository/worker instances.

The original in-memory `BoundedProjectWorker` remains for focused unit tests; the async dispatcher uses `PersistentProjectMemoryWorker`.

## Validation already completed

The latest implementation checkpoint passed:

- live PostgreSQL project-memory integration tests: 3 passed;
- full test suite: 33 files, 105 tests passed;
- TypeScript typecheck: passed;
- `git diff --check`: passed;
- ordered PostgreSQL migrations applied successfully to the local database at `127.0.0.1:5433`.

The app launch was also verified from this checkout:

- `http://localhost:3017/sandbox` returned HTTP `200`;
- page identity matched the Sandbox/Memory application;
- Next.js reported ready on port `3017` with `.env.local` loaded.

These are code, test, database, and HTTP checks. They are not a substitute for full browser interaction, production deployment, or cross-platform capture evidence.

## Current worktree rules

There is a large intentional uncommitted implementation set. Preserve it. Do not reset, clean, overwrite, or commit unrelated work. Preserve `.firecrawl/` as untracked. No commit was created for the latest runtime hardening or this handoff.

Inspect before editing:

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
git status --short --branch
git diff --stat
```

## Recommended next session sequence

1. Verify the app process and PostgreSQL availability.
2. Run the focused restart/recovery integration tests and the full test/typecheck gates.
3. Inspect the live audit route at `/sandbox/context`; keep the explicit empty state when no project scope is selected.
4. Connect the audit surface to live PostgreSQL project events, durable jobs, checkpoints, governance decisions, and manifest records only through explicit scoped read contracts.
5. Add route-level/API tests for audit reads, tenant/project scope isolation, stale leases, retry/dead-letter visibility, and empty/error states.
6. Perform browser QA against the running app and distinguish it from HTTP-only verification.
7. Update the blueprint and this handoff only after the above evidence exists.

## Pending gaps

- visual browser QA for the audit surface and context route;
- production-style build/start smoke verification after the latest runtime changes;
- complete live PostgreSQL audit-read API and UI wiring;
- stronger multi-process integration coverage using separately spawned worker processes, if required by the deployment target;
- operational tuning and observation of queue latency, lease duration, retry backoff, dead-letter volume, and checkpoint lag;
- external platform capture remains limited to available exports/connectors and must not be represented as complete cross-platform history;
- no commit or deployment has been performed.

## Guardrails

- Keep ingestion and enqueue operations bounded and asynchronous; MCP/chat request latency must not wait for extraction or manifest generation.
- Preserve exact source references and provenance. Raw evidence is not durable memory until replayed and governed.
- Keep project/tenant scope in every read and write path.
- Never silently delete historical events; use supersession or invalidation.
- Never invent unavailable conversation history or claim capture from unsupported platforms.
- Do not expose secrets in manifests, audit responses, logs, or handoffs.

## Handoff completion check

The next chat has consumed this handoff when it can identify the nested repository, verify the current branch and dirty worktree, locate the persistent worker and PostgreSQL repository code, reproduce the three restart/recovery integration tests, confirm the app URL, and state the audit-surface/live-PostgreSQL wiring as the next major implementation boundary.
