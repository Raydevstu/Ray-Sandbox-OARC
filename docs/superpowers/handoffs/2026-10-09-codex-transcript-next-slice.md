# Handoff: Codex transcript-aware capture and project identity

Date: 2026-10-09
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`
Branch: `renewal-roadmaps`

## Current verified status

The local Ray Memory staging path is operational for Codex lifecycle capture.

- Docker staging app: `http://127.0.0.1:3028`
- PostgreSQL staging: `127.0.0.1:5443`
- Ray Memory plugin: installed, enabled, and refreshed from the local marketplace
- Codex `UserPromptSubmit`: captures the exact submitted prompt
- Codex `Stop`: captures the assistant response
- Events reach PostgreSQL automatically without manual export
- Worker jobs for the live test completed successfully
- Typecheck passed
- Focused connector/import tests passed: 6/6
- Plugin syntax check passed
- `git diff --check` passed

The live verification sentence was:

`Ray Memory automation test: preserve this exact sentence.`

The database contained both the prompt and assistant response under `codex-hook` references, with completed worker jobs.

## Completed implementation slice

The plugin script at `plugins/ray-memory/scripts/capture-event.mjs` now:

- maps `UserPromptSubmit` to a `user` message;
- maps `Stop` to an `assistant` message;
- preserves hook metadata as provenance;
- redacts sensitive keys;
- sends workspace path metadata;
- uses the shared `/api/project-memory/import` boundary.

The installed plugin was refreshed with:

```powershell
codex plugin remove ray-memory@ray-sandbox-local
codex plugin add ray-memory@ray-sandbox-local
codex plugin list --marketplace ray-sandbox-local
```

## Next implementation slice

Implement Codex transcript-aware capture and project identity correction.

Acceptance criteria:

1. Prefer the hook-provided `prompt` and `last_assistant_message` fields.
2. When available, safely read `transcript_path` to recover the bounded conversation context.
3. Never expose transcript paths, secrets, or raw credentials in logs or API errors.
4. Keep event identity deterministic and idempotent across retries.
5. Resolve the project identity from repository/workspace metadata instead of defaulting to the broad parent directory.
6. Preserve the current fallback behavior when transcript access is unavailable.
7. Add focused tests for transcript parsing, malformed JSONL, redaction, deduplication, and project derivation.
8. Rebuild staging and run a real multi-message Codex test.

## Recommended later slices

1. Context retrieval provider for future prompts.
2. Hermes adapter using the same import envelope.
3. OpenAI API adapter without requiring an OpenAI key for storage-only ingestion.
4. OpenCode and VS Code workspace adapters.
5. Persistent worker service, retries, monitoring, retention, deletion, and production authentication.

## Verification commands

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
npm run typecheck
npm test -- --run tests/runtime/platform-connectors.test.ts tests/runtime/cross-platform-import.test.ts
node --check .\plugins\ray-memory\scripts\capture-event.mjs
docker compose -f docker-compose.staging.yml build app
docker compose -f docker-compose.staging.yml up -d app
npm run staging:validate
git diff --check
```

## Operating rules

- Preserve the dirty worktree; do not reset, clean, or overwrite unrelated changes.
- Do not commit unless explicitly requested.
- Do not print credentials or raw authorization headers.
- Keep synthetic, hook, worker, browser, and production evidence separate.
- Do not claim full cross-platform automation until each host has an approved connector or hook.
- Keep the repository private unless explicitly instructed otherwise.
