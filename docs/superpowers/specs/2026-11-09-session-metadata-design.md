# Design: Session Metadata Table for Temporal Project Queries

## Intent

Enable the memory app to answer temporal questions like "what was the last project I worked on", "what projects did I work on this week", and "how many sessions did I have today" by storing structured session metadata alongside facts.

## Goals

- Store session metadata (id, cwd, last_activity_at, message_count, bank_id) in a dedicated Postgres table
- Write session metadata during hermes-push sync and watcher-loop imports
- Provide `get_last_project()` and `list_recent_projects()` queries
- Backfill existing sessions from Hermes state.db

## Non-goals

- Changing fact storage or recall ranking
- Replacing the hermes-push sync flow
- Real-time session tracking (sync is still batch, every 5m)

## Constraints

- Additive only: new table, no changes to existing `facts` schema
- Must handle existing 12,511 facts (backfill required)
- Must work with existing hermes-push and watcher-loop paths
- No new npm dependencies

## Data Model

### sessions table

```sql
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'sandbox-tenant',
  bank_id TEXT NOT NULL,
  cwd TEXT NOT NULL,
  project_name TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, session_id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_bank_activity ON sessions(tenant_id, bank_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_activity ON sessions(tenant_id, last_activity_at DESC);
```

### project_name derivation

Extract from cwd basename (e.g. `D:/Projects/GLM CORTEXT ORCASTRATOR` → `GLM CORTEXT ORCASTRATOR`). Fallback to bank_id if cwd is empty.

## Approaches

### Option 1: Session Metadata Table (chosen)

New `sessions` table, populated during sync. Queries are simple SQL.

**Tradeoffs**: Requires backfill migration. Clean queries. Decoupled from Hermes DB.

### Option 2: Fact Provenance Enrichment

Add cwd/sessionId to fact provenance JSONB. No new table.

**Tradeoffs**: JSONB query complexity. Less clean.

### Option 3: Direct state.db Query

MCP server reads Hermes state.db directly.

**Tradeoffs**: Couples to Hermes schema. Breaks on format changes.

**Decision**: Option 1 — cleanest, most maintainable.

## Implementation Parts

### Part 1: DDL + Repository

- Add `SESSIONS_DDL` to `lib/server/pg-lifecycle.ts`
- Wire into `ensureSchema()` in `lib/server/pg-client.ts`
- Create `lib/server/session-repository.ts`:
  - `upsertSession(pool, session)` — insert or update on conflict
  - `getLastProject(pool, tenantId)` — most recent session across all banks
  - `listRecentProjects(pool, tenantId, limit)` — distinct projects by recency
  - `getSessionFacts(pool, tenantId, sessionId)` — all facts from a session
  - `countSessionsByDay(pool, tenantId)` — sessions per day

### Part 2: Sync Integration

- Update `lib/server/hermes-push.ts`: when ingesting, also upsert session metadata
- Update `lib/server/hermes-sync.ts`: same for watcher-loop path
- Update `scripts/hermes-push.mjs`: include session cwd in push payload

### Part 3: Backfill Script

- `scripts/backfill-sessions.mjs`: reads Hermes state.db, extracts (session_id, cwd, last_activity_at, message_count), upserts to sessions table
- Maps cwd to bank_id via existing cwd→bank logic
- Runs once to populate the table for existing 89 sessions

### Part 4: MCP Tool

- Add `get_last_project` tool to `mcp-server/index.ts`:
  - Returns: project name, cwd, last activity time, message count, top facts from that session
- Add `list_recent_projects` tool:
  - Returns: last N projects with activity timestamps

### Part 5: API Endpoint

- `GET /api/v1/memory/last-project` — returns the most recent project with session summary

## What's Left to Builder

- SQL query tuning for `listRecentProjects` (distinct by cwd, ordered by max activity)
- Fact content selection for session summary (top N by importance)
- Error handling for missing cwd (sessions without cwd)

## Success Criteria

- `get_last_project` returns the most recent session's project correctly
- Session metadata upserts idempotently during sync (re-sync doesn't duplicate)
- Backfill populates all 89 sessions from state.db
- MCP tool `get_last_project` is callable from Hermes

## Estimated Size

Small change — 5 files created/modified, 1 migration script, ~400 lines of code.
