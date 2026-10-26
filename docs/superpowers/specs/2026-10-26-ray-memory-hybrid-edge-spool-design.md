# Ray Memory Hybrid Edge Spool Design

Date: 2026-10-26  
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`

## Intent

Adopt the useful parts of the attached Ray Memory OS proposal—local hook capture, redaction, bounded context packets, idempotency, and offline tolerance—without creating a second canonical memory system.

The local SQLite process is an edge spool only. PostgreSQL remains the canonical durable store and the existing governed project-memory pipeline remains responsible for extraction, authorization, provenance, event-ledger mutation, and canonical persistence.

## Goals

- Capture Codex lifecycle payloads locally when the network or staging API is unavailable.
- Redact secrets before both SQLite persistence and synchronization.
- Preserve project identity, event identity, timestamps, hook event, session/turn metadata, and source provenance.
- Synchronize queued spool events into the existing authenticated Codex ingestion boundary.
- Make every synchronization outcome explicit: `queued`, `processed`, `failed`, or `dead-letter`.
- Make retries idempotent and bounded.
- Inject only a capped evidence packet during recall hooks; never dump the SQLite bank or raw episode log.
- Support Windows and Unix launch environments without silently assuming `$HOME` or `python3`.

## Non-goals

- SQLite is not a second user-facing memory bank or canonical read path.
- No replacement of PostgreSQL, `project_memory_records`, or the existing governed extraction pipeline.
- No production deployment, external connector authorization, or automatic installation of host hooks.
- No hard deletion of captured evidence; forget/archive must preserve the episode and audit trail.
- No claim of full desktop Codex capture until a real authorized host journey proves it.

## Anti-goals

- Do not silently fall back from PostgreSQL to SQLite while reporting canonical success.
- Do not allow MCP or spool operations to bypass tenant, bank, or project scope.
- Do not send raw transcript paths, credentials, tokens, or unredacted model output to either store.
- Do not let a local model write canonical records directly; its output remains an extraction proposal.

## Chosen approach

The implementation has four bounded parts:

1. **Edge capture library**
   - Adapt the proposal’s Python capture logic into a repository-owned, testable local component.
   - Store redacted episodes and capture rows in SQLite under an explicit local path.
   - Use deterministic project identity resolution with `.ray-memory.json`, absolute cwd, remote, and host identity aliases.
   - Enforce a configurable episode-size and queue-size bound.

2. **Synchronizer**
   - Claim queued spool rows with a lease and attempt counter.
   - Submit normalized events to the existing `/api/project-memory/codex-event` contract through an authenticated client.
   - Mark rows `processed` only after the canonical API acknowledges durable acceptance.
   - Mark retryable failures `failed` with `retryAt`; move exhausted rows to `dead-letter`.
   - Use a stable idempotency key derived from project, source event, session/turn, and redacted content hash.

3. **Bounded recall/MCP adapter**
   - Keep `memory_recall`, `memory_retain`, `memory_health`, and `memory_forget` behind the same project scope.
   - Recall returns a capped packet containing evidence IDs, types, confidence, active/superseded state, and explicit empty/error state.
   - Forget archives a scoped memory; it never deletes the episode or canonical evidence.

4. **Host packaging**
   - Add a repository-owned plugin package with a valid `.codex-plugin/plugin.json`, hooks, skill, and MCP manifest.
   - Use a launcher that resolves the configured Python interpreter and data directory on Windows and Unix.
   - Treat the attached hook/plugin files as proposal inputs; do not copy their path or trust assumptions unchanged.

## Canonical synchronization contract

The spool event must contain:

- `tenantId`, `bankId`, and `projectId`;
- stable `sourceEventId` and `idempotencyKey`;
- platform, conversation/session/turn/message identifiers;
- hook event name and observed timestamp;
- redacted content or bounded content hash where content is not needed;
- source path/remote metadata only when safe and non-secret.

The synchronizer must fail closed when tenant, bank, or project scope is missing or does not match the authenticated destination. A successful local SQLite write means only `queued`; it never means canonical persistence.

## Validation boundary

The first vertical slice will prove:

- redaction and bounded capture;
- deterministic project binding and duplicate suppression;
- queued → processed transition against a test HTTP transport;
- retry and dead-letter transitions;
- scope rejection and no canonical-success claim on API failure;
- bounded recall packet and archive-only forget behavior;
- Windows-compatible launcher resolution;
- existing PostgreSQL project-memory tests remain green.

The first slice will not claim live host/plugin verification. That requires a separately authorized installation/trust step and a real Codex lifecycle journey.

## Files expected for the first slice

- Create: `services/memory-os/ray_memory_os.py` or the repository’s equivalent local spool module.
- Create: focused tests for capture, sync states, scope, redaction, and packet limits.
- Create: plugin package under `plugins/ray-memory-os/` only after the core spool contract is tested.
- Modify: existing Codex ingestion/client contracts only where needed to accept stable idempotency metadata.
- Do not modify: PostgreSQL schema or canonical project-memory semantics until the edge contract and tests are green.

## Open decision before implementation

The initial implementation should use the existing Python proposal as the compatibility reference but may refactor it into smaller modules for testability and Windows portability. No code should be copied into the installed host configuration until the repository tests and design review pass.
