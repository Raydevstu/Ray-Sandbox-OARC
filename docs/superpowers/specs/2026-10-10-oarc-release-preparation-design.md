# Ray Sandbox OARC release preparation design

## Status and purpose

This specification defines a recoverable release-preparation path for Ray Sandbox OARC. Its goals are to consolidate the repository onto `main`, `trial`, and `backup` at the selected `oarc` remote, prove the existing Codex capture boundary with an isolated test project, and establish local PostgreSQL staging evidence before any production release claim.

This is a design artifact. It does not authorize a remote push, force-push, branch deletion, deployment, provider call, connector authorization, credential access, or production configuration change.

## Current observed state

- The working checkout is detached at `0d24489` and has substantial tracked and untracked work that must be inventoried before a release commit is created.
- The selected canonical remote is `oarc` (`Raydevstu/Ray-Sandbox-OARC`). The current read-only remote listing exposes historical `V1`; `main` is currently visible on the separate `origin` remote. The missing `oarc/main` must be resolved through an explicit migration step; it must not be inferred or force-created during audit.
- Existing code includes a redacting, scoped Codex capture/import boundary, but automatic host capture and durable end-to-end test-project evidence must be independently proven.
- PostgreSQL remains the canonical durable store. Browser-local Zustand data and synthetic visual-gallery data are not production or durable-evidence substitutes.

## Goals

1. Preserve every existing commit and dirty file before making a release candidate.
2. Establish exactly three future working branches at `oarc`: `main`, `trial`, and `backup`.
3. Use `production` only as a deployment environment or signed release tag, never as a permanent Git branch.
4. Create a dedicated, isolated Codex integration test project with no customer or production data.
5. Prove one real local/staging Codex journey with redaction, idempotency, server-derived scope, durable provenance, worker outcome, and protected readback.
6. Produce evidence-scoped staging readiness results without claiming deployment, live connector, provider-quality, or production verification.

## Non-goals

- Deleting old local or remote branches.
- Rewriting or force-pushing `oarc/main` or `oarc/V1`.
- Deploying externally, publishing a release, or changing production credentials/JWT configuration.
- Reading or pasting secrets, raw transcripts, or customer content.
- Treating synthetic dashboard data, a browser `200`, or a successful build as durable Codex capture evidence.

## Branch and remote model

| Ref | Role | Mutation rule |
|---|---|---|
| `oarc/main` | release source | receives only a verified fast-forward or reviewed merge from `trial` |
| `oarc/trial` | staging and integration candidate | accepts the audited release-candidate commit and follow-up fixes |
| `oarc/backup` | immutable recovery point | created before the first promotion and updated only through an explicit recovery procedure |
| production tag/environment | deployment identity | references a verified `main` commit; not a branch |
| existing `V1`, `V2-design`, and other refs | historical recovery evidence | preserved and untouched during this effort |

Before any remote mutation, the release operator must record:

- the full working-tree manifest, including untracked files;
- the selected set of product, test, migration, and documentation files for the candidate;
- a commit hash and annotated recovery reference for the candidate;
- the remote branch tips for `oarc/main` and `oarc/V1`;
- the exact merge or rebase relationship that proves no remote history was silently replaced.

No `git clean`, `reset --hard`, branch deletion, force-push, or broad staging command is permitted.

## Codex integration test project

The test project is a dedicated, disposable project identity with its own tenant, bank, project, and run scope. It has no production credentials and contains only pre-approved synthetic prompts.

The test sequence is:

1. Deliberately establish the local development test identity under the existing local-only safeguards.
2. Submit at least a user and assistant Codex activity record through the supported capture adapter.
3. Verify sensitive keys are redacted before persistence or telemetry.
4. Verify retries and duplicate delivery preserve idempotency.
5. Confirm server-derived tenant/bank/project scope rejects cross-scope reads and writes.
6. Confirm immutable source evidence, event-ledger entries, and correlation/idempotency metadata exist in PostgreSQL.
7. Run the worker or bounded processor and distinguish `queued` from completion with direct evidence.
8. Read the resulting evidence through an authenticated protected route and the relevant operator browser view.

The resulting proof is `LOCALLY VERIFIED` and, if a real authenticated browser journey succeeds, `BROWSER VERIFIED`. It is not `LIVE CONNECTOR VERIFIED` or `PRODUCTION VERIFIED`.

## Staging readiness gates

Staging uses the approved Docker/PostgreSQL path and an intentionally non-production configuration. It must verify:

- migrations apply to an empty and representative existing PostgreSQL state;
- health, readiness, root HTML, a CSS asset, a JavaScript asset, and the relevant API health route respond from the intended checkout;
- authentication and project scope fail closed;
- retained/captured data has provenance and an event-ledger record;
- empty, queued, healthy, degraded, unavailable, failed, and unauthorized states are represented where applicable;
- tests cover keyboard navigation, visible focus, reduced motion, 375/768/1440 layouts, and serious/critical axe violations;
- a local test-project sequence completes from capture through worker/readback.

Required release-candidate commands will be specified in the implementation plan. At minimum they will include focused runtime tests, `npm test`, `npm run typecheck`, relevant serial Playwright tests, staging validation, PostgreSQL audit, and `git diff --check`.

## Failure and recovery rules

- Any scope, redaction, migration, provenance, or event-ledger failure blocks promotion.
- A failed Codex test-project journey remains an explicit failed or queued state; it cannot be reported as capture success.
- A staging failure leaves `main` and production unchanged. Fixes remain on `trial`.
- Recovery uses the preserved `backup` reference and recorded candidate commit. No destructive history rewrite is needed.
- Existing branches remain available until a later, separately approved archival decision.

## Promotion decision

Promotion from `trial` to `main` requires all of the following direct evidence:

1. An auditable candidate commit with only approved files.
2. A preserved and remotely visible `backup` reference.
3. All required automated checks passing.
4. Staging migration, health/readiness, canonical PostgreSQL, and authenticated browser evidence passing.
5. The dedicated Codex test-project path completed with durable, scoped, redacted evidence and worker/readback proof.
6. An explicit user authorization to push/promote after reviewing the evidence.

After promotion, production remains pending until the user separately authorizes deployment. A signed tag may identify the approved `main` commit, but it does not itself deploy anything.

## Acceptance criteria

- The future working branch model is exactly `main`, `trial`, and `backup` at `oarc`.
- No historical branch or uncommitted file is lost.
- The test project is isolated and uses only synthetic approved data.
- Codex capture is proven with source evidence, redaction, scope, idempotency, worker state, and protected readback.
- Staging evidence is recorded with precise evidence labels and limits.
- No production, external connector, provider quality, or deployment claim is made without its direct gate.
