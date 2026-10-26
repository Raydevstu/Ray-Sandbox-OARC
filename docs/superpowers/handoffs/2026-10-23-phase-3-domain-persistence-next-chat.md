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

## 2026-10-26 continuation update

### Repository and runtime state

- The canonical repository is `Raydevstu/Ray-Sandbox-OARC`.
- GitHub default branch is now `main`.
- Only two active GitHub branches remain:
  - `main`
  - `codex/preserve-hermes-runtime-2026-10-23`
- Both branches point to merge commit `655c08b` (`Merge remote-tracking branch 'oarc/main' into codex/preserve-hermes-runtime-2026-10-23`).
- The local worktree remains on `codex/preserve-hermes-runtime-2026-10-23`.
- Preserve untracked `.firecrawl/` and `test-results/`; they are user-owned generated artifacts and were not deleted or committed.

### Runtime evidence

- Latest staging image was rebuilt from the current branch and is running at `http://127.0.0.1:3028`.
- The visible app identity is `Ray Sandbox OARC — Agent Memory Orchestration`.
- `/api/v1/health` and `/api/v1/ready` returned HTTP 200.
- PostgreSQL staging volume was preserved.

### Codex project-memory gap

- `Rayclaude-wiki` has one stored `facts` row: `Rayclaude-wiki Codex memory wiring proof`, confidence `0.70`.
- It has one `CodexConversationEvent` and one `ProjectWorkerCompleted` event with `9 ms` latency.
- It has zero active `project_memory_records`.
- Root cause confirmed in `lib/runtime/memory-extraction.ts`: the deterministic extractor only creates records for explicit decision, requirement, risk, blocker, or follow-up language. The captured text `Tier1 is wired to Rayclaude-wiki memory.` matches none of those rules, so capture and worker completion succeeded while extraction produced zero candidates.
- Do not describe Codex wiring as full project-memory capture until a meaningful Codex message produces a governed, provenance-linked `project_memory_records` row.

### Exact next boundary

1. Add a focused regression test proving a captured Codex statement such as `We decided to keep Rayclaude-wiki on the PostgreSQL memory path` creates a governed project-memory record.
2. Decide and implement the smallest safe extraction improvement for ordinary project statements, while preserving explicit degraded/provider states.
3. Re-run the Rayclaude-wiki live capture path and verify event, worker completion, candidate extraction, canonical record, provenance, and readback separately.
4. Only then continue the existing Context Tuning persistence boundary below.

## 2026-10-26 Codex project-memory extraction checkpoint

- `IMPLEMENTED`: the deterministic decision rule now recognizes the meaningful past-tense Codex form `decided`, preserving the existing explicit-rule, provider, and degraded-fallback boundaries.
- `TESTED`: `tests/runtime/memory-extraction.test.ts` adds a regression for `We decided to keep Rayclaude-wiki on the PostgreSQL memory path.`; the focused related suite passed `5` files / `28` tests, and the full suite passed `114` files / `366` tests with `2` files / `6` tests skipped. Typecheck and `git diff --check` passed.
- `LOCALLY VERIFIED`: the rebuilt Docker staging app at `http://127.0.0.1:3028` returned the intended app identity, health `200`, and readiness `200`.
- `LOCALLY VERIFIED`: the exact `Rayclaude-wiki` staging project moved from `2` source/lifecycle events and `0` audit records to `5` events and `1` active `decision` record. The new ledger events were `CodexConversationEvent`, `ProjectMemoryRecorded`, and `ProjectWorkerCompleted`; the worker reached `processed`.
- `LOCALLY VERIFIED`: PostgreSQL readback preserved `platform: codex`, the submitted conversation and message IDs, and `evidence: conversation` referencing the submitted message ID. This is canonical local staging evidence, not production or external live-connector evidence.
- The original zero-record finding is resolved for meaningful past-tense decisions. Ordinary statements without a supported decision, requirement, risk, blocker, or follow-up signal remain intentionally unclassified; full automatic desktop Codex capture remains a separate boundary.

### Next boundary

Continue with the existing Context Tuning dedicated persistence boundary: write the failing `ContextConfig` repository test first, then implement migration, repository, route, UI hydration/save, scope isolation, and refresh persistence.

## 2026-10-26 Ray Memory edge-spool sync checkpoint

- `TESTED / LOCALLY VERIFIED`: the installed Ray Memory synchronizer captured one temporary redacted edge event and submitted it through the authenticated local staging Codex-event route. The edge capture moved from `queued` to `processed` in one attempt with no failure or dead-letter state.
- `LOCALLY VERIFIED`: PostgreSQL readback for the unique marker contains the source `CodexConversationEvent`, governed `ProjectMemoryRecorded`, active decision content with redacted secret/path fields, conversation evidence, and a `complete` `codex-event-hook` job.
- `TESTED / LOCALLY VERIFIED`: focused Codex capture/pipeline/worker/status tests passed `15/15`; `npm run staging:validate`, `npm run typecheck`, and `git diff --check` passed.
- Evidence boundary: this proves the local installed-runtime → local Docker/PostgreSQL staging path. SQLite is only the edge spool; production, browser, external-provider, and automatic desktop-capture evidence remain unclaimed.

### Next boundary

Restore the repository-owned edge-spool implementation and add the missing `tests/runtime/ray-memory-edge-sync.test.ts` regression so the verified synchronizer path is reproducible from source rather than only from the installed plugin runtime.
