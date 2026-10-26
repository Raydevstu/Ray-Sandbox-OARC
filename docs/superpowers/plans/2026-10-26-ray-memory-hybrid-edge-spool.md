# Ray Memory Hybrid Edge Spool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded, redacting, scope-aware SQLite edge spool that synchronizes idempotently into the existing governed PostgreSQL project-memory pipeline without presenting SQLite as canonical.

**Architecture:** A small Python standard-library spool owns local capture, project binding, bounded packet generation, and durable local queue state. A synchronizer submits normalized events to the existing authenticated Codex event endpoint and records explicit `queued`, `processed`, `failed`, and `dead-letter` outcomes. The existing PostgreSQL repository, extraction, governance, provenance, and event-ledger paths remain authoritative.

**Tech Stack:** Python 3 standard library, SQLite WAL, JSON/JSON-RPC stdio, existing TypeScript/Next.js Codex ingestion API, Vitest, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-10-26-ray-memory-hybrid-edge-spool-design.md`

## Global Constraints

- SQLite is an edge spool only; PostgreSQL remains the canonical durable store.
- A local write reports `queued`, never canonical success.
- Preserve tenant, bank, project, conversation, session, turn, message, timestamp, and provenance scope; missing scope fails closed for synchronization.
- Redact secrets before SQLite persistence, HTTP synchronization, packet injection, and model calls.
- Synchronization must be retry-safe, bounded, and idempotent.
- Archive-only forget preserves episodes and evidence.
- Do not install, trust, or modify host-level hooks without explicit authorization.
- Preserve unrelated dirty files, `.firecrawl/`, `test-results/`, and existing branch state; do not commit.

## Review Focus

- A missing or mismatched tenant/bank/project scope must reject synchronization rather than route to a default project. Test in Task 2.
- A duplicate capture must return the original result and must not create another episode or canonical request. Test in Task 1.
- A redaction pattern must not retain credentials, transcript paths, or model-generated secret-like output. Test in Task 1 and Task 3.
- A failed canonical endpoint must remain visibly `failed` or `dead-letter`; it must never be reported as processed. Test in Task 2.
- A packet must remain within the configured character/token budget and must omit the episode log. Test in Task 3.

---

### Task 1: Test-first local spool capture and project binding

**Files:**
- Create: `services/memory-os/ray_memory_os.py`
- Create: `services/memory-os/test_ray_memory_os.py`
- Create: `services/memory-os/__init__.py`

**Interfaces:**
- Produces `connect(path)`, `resolve_project(conn, cwd, display, explicit, host_project)`, `redact(text)`, `capture(conn, event)`, and `health(conn, project_id='')`.
- Capture returns a JSON-compatible result with `ok`, `duplicate`, `project`, `status`, `extracted`, and optional `episodeId`/`error`.
- Local statuses are `captured`, `extracted:<mode>`, `extracted:empty`, `failed`, and duplicate-preserved prior status; queue state is added in Task 2.

- [ ] **Step 1: Write failing tests**
  - Use a temporary SQLite database.
  - Verify schema initialization, project binding from `.ray-memory.json`, alias reuse, and first-bind behavior.
  - Verify secret and transcript-path redaction before episode storage.
  - Verify a `Stop` event containing `We decided to use Postgres instead of SQLite.` extracts a decision with an evidence episode ID.
  - Verify the same project/session/turn/content capture is duplicate-safe.
  - Verify an oversized event is bounded and marked truncated.

- [ ] **Step 2: Run the tests and confirm RED**

Run: `python -m unittest discover -s services/memory-os -p "test_*.py" -v`  
Expected: failure because the spool module and capture contract do not yet exist.

- [ ] **Step 3: Implement the minimal SQLite spool**
  - Use SQLite WAL and foreign keys.
  - Keep the proposal’s tables only where they support the edge contract: projects, aliases, episodes, captures, and memories.
  - Add explicit maximum episode bytes and deterministic idempotency hashing.
  - Keep heuristic extraction deterministic and redact all stored text before extraction.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `python -m unittest discover -s services/memory-os -p "test_*.py" -v`  
Expected: all Task 1 tests pass with no network access.

### Task 2: Lease-based synchronization into the governed Codex endpoint

**Files:**
- Modify: `services/memory-os/ray_memory_os.py`
- Modify: `services/memory-os/test_ray_memory_os.py`
- Create: `services/memory-os/test_sync.py`

**Interfaces:**
- Add `claim_sync_rows(conn, limit, now, lease_seconds)`.
- Add `sync_once(conn, sender, config, now)` where `sender(payload, config)` returns an HTTP-like `{status, body}` result.
- Add sync columns/state: `sync_status`, `attempts`, `available_at`, `leased_until`, `last_error`, `canonical_event_id`.
- `sync_once` returns counts for `claimed`, `processed`, `failed`, `deadLettered`, and `scopeRejected`.

- [ ] **Step 1: Write failing tests**
  - Verify a queued capture is claimed once and a successful authenticated response becomes `processed`.
  - Verify a transport failure becomes retryable `failed` with a future retry time.
  - Verify attempts beyond the configured maximum become `dead-letter`.
  - Verify missing scope and mismatched authenticated scope are rejected without a request marked processed.
  - Verify the stable idempotency key is reused across retries.

- [ ] **Step 2: Run the tests and confirm RED**

Run: `python -m unittest discover -s services/memory-os -p "test_sync.py" -v`  
Expected: failure because lease and synchronization methods do not yet exist.

- [ ] **Step 3: Implement the synchronizer**
  - Use `urllib.request` or an injected sender; never require the live server in unit tests.
  - Send only the normalized, redacted Codex envelope accepted by the existing route.
  - Require an authenticated configuration for non-local destinations.
  - Use bounded exponential retry and explicit dead-letter state.

- [ ] **Step 4: Run focused synchronization tests**

Run: `python -m unittest discover -s services/memory-os -p "test_sync.py" -v`  
Expected: all state-transition, scope, retry, and idempotency tests pass.

### Task 3: Bounded recall packet and archive-only MCP behavior

**Files:**
- Modify: `services/memory-os/ray_memory_os.py`
- Create: `services/memory-os/test_packet.py`

**Interfaces:**
- Add `recall_packet(conn, project_id, query, budget_chars=1800)`.
- Add `archive_memory(conn, project_id, memory_id, now)`.
- Add `mcp_dispatch(conn, message, scope)` for `memory_recall`, `memory_retain`, `memory_health`, and `memory_forget`.

- [ ] **Step 1: Write failing tests**
  - Verify packet output includes active decisions, blockers, requirements, evidence IDs, confidence, and superseded labels.
  - Verify packet output is capped and never contains the episode log or unredacted secret.
  - Verify recall for an unknown project is explicit empty state.
  - Verify forget archives only a memory in the requested project and leaves episode rows intact.
  - Verify MCP calls without required project scope fail closed.

- [ ] **Step 2: Run tests and confirm RED**

Run: `python -m unittest discover -s services/memory-os -p "test_packet.py" -v`  
Expected: failure because packet and scoped MCP methods do not yet exist.

- [ ] **Step 3: Implement bounded packet/MCP behavior**
  - Return JSON-RPC content only; never return the full bank.
  - Validate tool names and argument shapes.
  - Keep archive semantics append-only with timestamps.

- [ ] **Step 4: Run focused packet tests**

Run: `python -m unittest discover -s servser with explicit lifecycle event input and bounded timeouts.
- The skill instructs recall-first behavior, untrusted evidence handling, archive-only forget, and no bank scanning.

- [ ] **Step 1: Write failing manifest/contract tests**
  - Validate plugin manifest paths exist and point to `.mcp.json`, hooks, and skill.
  - Validate hooks use the launcher and do not contain hard-coded `$HOME` or `127.0.0.1:3028` dependencies.
  - Validate MCP tool names match the tested Python dispatch contract.
  - Validate the skill does not instruct direct SQLite inspection.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- --run tests/runtime/ray-memory-plugin-contract.test.ts`  
Expected: failure because the new package files do not yet exist.

- [ ] **Step 3: Implement the package and launcher**
  - Keep the attached proposal’s user-facing intent but correct path, Windows, scope, and manifest issues.
  - Do not install or refresh the host plugin as part of this task.

- [ ] **Step 4: Run manifest tests and Python self-check**

Run: `npm test -- --run tests/runtime/ray-memory-plugin-contract.test.ts` and `python services/memory-os/ray_memory_os.py self-check`  
Expected: both pass; no host-level installation is performed.

### Task 5: Governed API contract and local integration proof

**Files:**
- Modify: `lib/runtime/codex-hook-client.ts` only if stable idempotency metadata is missing.
- Modify: `tests/runtime/codex-hook-client.test.ts` if the client contract changes.
- Create: `tests/runtime/ray-memory-edge-sync.test.ts`
- Modify: `docs/superpowers/handoffs/2026-10-23-live-codex-capture-next-chat.md`
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`

**Interfaces:**
- The integration proof uses a fake sender for unit coverage and the existing local staging route only for separately labeled local verification.
- No new canonical storage table is added unless a focused contract test proves an existing schema cannot represent the spool idempotency boundary.

- [ ] **Step 1: Write the failing integration test**
  - Submit a meaningful Codex decision through the spool/sync boundary.
  - Assert local `queued`, canonical API acknowledgement, `processed`, and stable duplicate behavior.
  - Assert scope failure, retry, and dead-letter states remain distinct.

- [ ] **Step 2: Run the focused integration test and confirm RED**

Run: `npm test -- --run tests/runtime/ray-memory-edge-sync.test.ts`  
Expected: failure until the edge-to-governed contract is wired.

- [ ] **Step 3: Implement only the necessary adapter wiring**
  - Reuse the existing Codex envelope and governed route.
  - Do not introduce a parallel project-memory read path.

- [ ] **Step 4: Run all focused and existing validation**

Run:

```powershell
python -m unittest discover -s services/memory-os -p "test_*.py" -v
npm test -- --run tests/runtime/ray-memory-edge-sync.test.ts tests/runtime/codex-hook-client.test.ts tests/runtime/project-memory-pipeline.test.ts
npm run typecheck
git diff --check
```

Expected: all tests and typecheck pass; no browser, production, external connector, or host-install claim is made.
