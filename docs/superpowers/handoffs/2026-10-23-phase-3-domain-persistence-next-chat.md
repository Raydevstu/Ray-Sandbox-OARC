# Phase 3 Domain Persistence — Next Chat Handoff

Date: 2026-10-23
Repository: D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice
Canonical local runtime: http://127.0.0.1:3028
PostgreSQL staging: Docker Compose service postgres, container hindsight-memory-slice-postgres-1, host port 5443

## User request

Continue Phase 3 until these are fully durable:

1. Context Tuning durable runtime persistence.
2. Evaluation UI wired to canonical evaluation/replay APIs.
3. Continuous Learning durable runtime workflow.
4. Orchestrator durable workflow execution.

## Implemented

- Memory Runtime uses canonical retain, recall, and correction APIs.
- Prompt Studio has durable PostgreSQL prompt-version persistence:
  - db/migrations/0014_prompt_versions.sql
  - app/api/v1/prompts/route.ts
  - lib/runtime/prompt-client.ts
  - repository interface, PostgreSQL repository, and test double
- Evaluation Runtime mode calls POST /api/v1/memory/evaluate.
- Added POST /api/v1/workflow/step.
- Added lib/runtime/phase3-client.ts.
- Context Tuning posts a scoped context workflow step.
- Continuous Learning posts a scoped learn workflow step.
- Orchestrator posts a scoped orchestrate workflow step.
- Workflow progress advances durable workflow_runs.
- Runtime failures are explicit; local deterministic behavior is not silently reported as canonical success.

## Verified

- Full Vitest: 109 files passed, 353 tests passed, 6 skipped.
- Typecheck passed.
- git diff --check passed; existing LF/CRLF warnings remain.
- Docker staging build passed.
- App restarted successfully on port 3028.
- GET http://127.0.0.1:3028/api/v1/health returned 200.
- Correct-target staging browser suite passed 6/6 at Chromium and mobile widths.
- Unauthenticated workflow-step request correctly failed with missing credentials.

## Important limitation

Phase 3 is not yet domain-persistence complete.

Context settings, Learning episode data, and Orchestrator graph/configuration are currently carried as workflow-step payloads while only workflow-run progress is durably persisted. Dedicated PostgreSQL tables, repository methods, read APIs, and UI hydration are still required.

Do not claim Phase 3 complete until every surface can save and read its domain object after refresh, enforce tenant/bank/project scope, return the canonical envelope, preserve audit/event evidence, and pass repository/API/browser tests.

## Next implementation order

### Step 1 — Context Tuning dedicated persistence

Add a context_configs migration with tenant, bank, project, config ID, version, settings JSON, and updated timestamp. Add ContextConfig repository methods to the interface, PostgreSQL repository, and test double. Add a canonical GET/POST route. Hydrate and save from the Runtime Context page. Test scope isolation, save/read, invalid settings, unavailable store, and refresh persistence.

Reuse the existing RecallSettings shape from lib/types.ts; do not duplicate validation.

### Step 2 — Evaluation browser integration

The UI calls /api/v1/memory/evaluate in Runtime mode. Complete canonical history hydration after refresh, wire replay/correction to /api/v1/memory/replay, display queued/unavailable/degraded/unauthorized/failed/retryable states, and add browser assertions for persistence and refresh/resume.

### Step 3 — Continuous Learning domain persistence

Add a durable learning episode contract/table containing tenant, bank, project, workflow run, episode ID, source chunk hash, tool-call trace metadata, core-memory revision/reference, judge/EM scores, timestamp, and idempotency key. Add repository, API, Runtime UI save/read, and tests. Preserve redaction rules.

### Step 4 — Orchestrator durable execution

Persist graph/config and run records, preserving scope and evidence invariants. Store node/edge definitions, mounted/active state, routing/data type, run and step state, event/outbox linkage, and failure/retry status. Add read-after-refresh and browser assertions.

### Step 5 — Final validation

Run:

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
npm test -- --run
npm run typecheck
git diff --check
docker compose -f docker-compose.staging.yml build app
docker compose -f docker-compose.staging.yml up -d app
npx playwright test tests/e2e/staging.spec.ts --workers=1
```

Then run the full E2E suite only against the canonical target:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3028'
npm run test:e2e
```

Never use :3000 as Phase 3 evidence; it is a different/stale app target in workspace history.

## Dirty-worktree boundary

Many earlier user-owned changes are present. Preserve them. Do not reset, clean, delete, move, or commit. Inspect git status --short before editing. Keep new changes limited to Phase 3 persistence.

Known generated/untracked artifacts include .firecrawl/ and test-results/; do not delete them without explicit authorization.

## First action in next chat

Read this handoff, then inspect lib/types.ts, lib/runtime/repositories/interfaces.ts, lib/runtime/repositories/postgres.ts, lib/runtime/repositories/test-double.ts, and app/sandbox/context/page.tsx. Write the failing ContextConfig repository test before adding migration or production code.

## Out of scope

- Production deployment or external connector authorization.
- Credential rotation or secrets changes.
- Claiming benchmark or production evidence from local Docker.
- Replacing PostgreSQL with browser/local storage for Runtime mode.
- Deleting or rewriting historical handoffs.

