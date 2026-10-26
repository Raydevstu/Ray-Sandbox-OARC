# SDD ledger — plan: docs/superpowers/plans/2026-10-10-oarc-release-preparation.md

Execution: native in the current preserved dirty worktree. No remote, branch, staging, or external project mutation is authorized before the explicit promotion checkpoint.

Pre-flight: shared interfaces — Task 1 manifest feeds Task 4 handoff; Task 2 proof result feeds Task 3 staging validation; Task 3 evidence feeds Task 4 handoff; Task 4 authorization gates Task 5 Git mutation.

Baseline: detached HEAD `0d2448982a1a5314ad0a2b7493d7d8c926831cdb`; existing dirty and untracked files preserved.

Task 1 ruling: read-only `oarc` listing currently exposes `V1` but not `main`; local/other-remote `main` history is not a safe substitute. Promotion remains blocked until the user reviews the exact source commit and explicitly authorizes creating `oarc/main`.

Task 1: complete
- Added read-only `scripts/release-candidate-manifest.mjs` and `npm run release:manifest`.
- RED observed: missing manifest module.
- GREEN: `npx vitest run tests/runtime/release-candidate-manifest.test.ts` passed 2/2.
- Manifest generated at `docs/benchmarks/release-candidate-manifest.json`; it reports the dirty/untracked worktree and unresolved `oarc/main` without mutation.
- `npm run typecheck` passed; `git diff --check` passed with existing line-ending warnings.

Task 2: complete
- Added local/staging-only `scripts/codex-integration-proof.mjs` and `npm run codex:proof`.
- RED observed: missing proof module.
- First GREEN attempt exposed a transcript-path identifier leak; redaction was tightened to remove the field name as well as its value.
- Focused Codex tests passed `10/10`, including redaction, duplicate safety, scope denial, queued state, and completed readback state.
- No external endpoint, credential, Codex test project, or staging database was contacted.
