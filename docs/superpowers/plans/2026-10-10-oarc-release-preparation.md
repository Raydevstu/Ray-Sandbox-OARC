# Ray Sandbox OARC Release Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely prepare an auditable `trial` release candidate at `oarc`, prove an isolated Codex capture journey on local PostgreSQL staging, and produce the evidence required for a separately authorized promotion to `main`.

**Architecture:** This plan keeps repository migration, Codex proof, and staging readiness separate. A manifest generator records candidate scope and remote tips without mutation; a dedicated test-project proof verifies capture/import/worker/readback through existing server boundaries; promotion remains an explicit human-authorized Git operation after all gates pass.

**Tech Stack:** Git/GitHub remote, Next.js App Router, TypeScript, Node.js scripts, Docker Compose PostgreSQL, Vitest, Playwright, existing Codex hook/import adapter.

**Spec:** `docs/superpowers/specs/2026-10-10-oarc-release-preparation-design.md`

## Global Constraints

- The future working branch model is exactly `main`, `trial`, and `backup` at `oarc`; production is a deployment environment or signed tag, not a branch.
- Preserve all existing commits, branches, uncommitted work, `.firecrawl/`, database files, logs, and test artifacts; do not run reset, clean, force-push, or branch deletion.
- PostgreSQL is canonical; local browser state and synthetic UI data cannot satisfy durable evidence requirements.
- The Codex test project contains only approved synthetic content. Never read, print, or commit secrets, raw transcripts, or customer content.
- Production JWT/authentication, provider calls, external connectors, external deployment, and production configuration remain out of scope.
- Evidence labels must distinguish `IMPLEMENTED`, `TESTED`, `LOCALLY VERIFIED`, `BROWSER VERIFIED`, `LIVE CONNECTOR VERIFIED`, and `PRODUCTION VERIFIED`.
- No commit, remote push, branch creation, staging mutation, or Codex test-project creation occurs until the task's explicit human-authorization checkpoint is reached.

## Review Focus

- A dirty or untracked file omitted from the release manifest must block candidate creation; Task 1 tests manifest completeness.
- A remote history mismatch or missing `oarc/main` must block any fast-forward/promotion command; Task 1 tests divergence reporting without remote mutation.
- A secret-like string or transcript path in a Codex test event must be redacted before durable persistence; Task 2 tests persisted payloads and logs.
- Duplicate user/assistant test events must preserve idempotency and create no duplicate canonical record; Task 2 tests repeat delivery.
- A queued or failed worker must never be reported as a completed Codex proof; Task 3 tests state-specific staging result handling.

---

## File structure

- `scripts/release-candidate-manifest.mjs` — read-only Git working-tree and remote-tip manifest generator.
- `scripts/codex-integration-proof.mjs` — local/staging proof runner using synthetic user/assistant events and explicit scope.
- `scripts/staging-validation.mjs` — extends the existing staging checks with proof-result states and durable evidence assertions.
- `tests/runtime/release-candidate-manifest.test.ts` — covers manifest classification and promotion blockers using injected command output.
- `tests/runtime/codex-integration-proof.test.ts` — covers redaction, idempotency, scope failure, queued/completed states, and readback contract with mocked HTTP boundaries.
- `tests/e2e/codex-integration-proof.spec.ts` — authenticated browser proof for the dedicated synthetic test-project output and visible operational states.
- `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md` — records exact implementation and verification evidence.
- `docs/superpowers/handoffs/2026-10-10-oarc-release-preparation-next-chat.md` — records branch tips, candidate commit, commands, evidence, holds, and rollback reference.

### Task 1: Read-only release-candidate manifest

**Files:**
- Create: `scripts/release-candidate-manifest.mjs`
- Create: `tests/runtime/release-candidate-manifest.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildReleaseCandidateManifest(input: ReleaseManifestInput): ReleaseCandidateManifest` exported from the script module, plus `npm run release:manifest`.
- Consumes: injected Git status, branch refs, remote tips, and current commit; the CLI executes read-only Git commands only.
- Used by: Task 4 release documentation and the human authorization checkpoint.

- [ ] **Step 1: Write failing manifest tests**

```ts
it('blocks promotion when untracked files or divergent remote tips are present', () => {
  const manifest = buildReleaseCandidateManifest({
    head: 'candidate',
    status: ['?? lib/new-file.ts'],
    localRefs: { main: 'local-main' },
    remoteRefs: { 'oarc/main': 'remote-main' },
    mergeBase: null,
  });
  expect(manifest.promotionEligible).toBe(false);
  expect(manifest.blockers).toContain('untracked files require explicit candidate selection');
});
```

- [ ] **Step 2: Run the manifest test to verify it fails**

Run: `npx vitest run tests/runtime/release-candidate-manifest.test.ts`

Expected: FAIL because the manifest module and script do not exist.

- [ ] **Step 3: Implement `buildReleaseCandidateManifest(input: ReleaseManifestInput): ReleaseCandidateManifest`**

Place the pure function in `scripts/release-candidate-manifest.mjs`; export it for Vitest. The CLI must call only `git status --porcelain=v1`, `git rev-parse HEAD`, `git branch --all --verbose --no-abbrev`, `git ls-remote --heads oarc`, and merge-base/log queries. Write a JSON manifest to a caller-supplied path or standard output; never stage, commit, create, delete, or push a ref.

- [ ] **Step 4: Add `release:manifest` package script**

Add `"release:manifest": "node scripts/release-candidate-manifest.mjs"` to `package.json`.

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run tests/runtime/release-candidate-manifest.test.ts`

Expected: PASS, including clean, dirty, untracked, divergent, and missing-remote cases.

- [ ] **Step 6: Record no-mutation evidence**

Run: `npm run release:manifest -- --output docs/benchmarks/release-candidate-manifest.json`

Expected: an inventory that reports current dirty/untracked files and remote tips, with no Git mutation.

### Task 2: Dedicated Codex synthetic integration proof

**Files:**
- Create: `scripts/codex-integration-proof.mjs`
- Create: `tests/runtime/codex-integration-proof.test.ts`
- Modify: `lib/runtime/codex-hook-client.ts` only if a small exported request-builder seam is required for direct testing.

**Interfaces:**
- Consumes: `CodexProofConfig { baseUrl: string; authorization?: string; scope: { tenantId: string; bankId: string; projectId: string }; conversationId: string; fetcher?: typeof fetch }`.
- Produces: `runCodexIntegrationProof(config: CodexProofConfig): Promise<CodexProofResult>` with independent `capture`, `duplicate`, `scopeDenial`, `worker`, and `readback` states.
- Used by: Task 3 staging validation and Task 4 release evidence documentation.

- [ ] **Step 1: Write failing proof tests**

```ts
it('reports completed only after synthetic user and assistant capture, duplicate rejection, scope denial, worker completion, and protected readback', async () => {
  const result = await runCodexIntegrationProof(testConfig);
  expect(result.status).toBe('completed');
  expect(result.capturedRoles).toEqual(['user', 'assistant']);
  expect(result.redacted).toBe(true);
  expect(result.scopeDenied).toBe(true);
});

it('keeps queued and failed worker states explicit', async () => {
  await expect(runCodexIntegrationProof(queuedWorkerConfig)).resolves.toMatchObject({ status: 'queued' });
});
```

- [ ] **Step 2: Run the proof tests to verify they fail**

Run: `npx vitest run tests/runtime/codex-integration-proof.test.ts`

Expected: FAIL because the proof runner does not exist.

- [ ] **Step 3: Implement `runCodexIntegrationProof(config: CodexProofConfig): Promise<CodexProofResult>`**

Use only synthetic fixed user/assistant text containing a deliberately secret-like value and a transcript-path field. Submit via the existing supported Codex/import boundary, repeat one event with the same idempotency key, attempt one cross-project read, poll the documented job/evidence route within a finite timeout, and fetch protected scoped readback. Return structured state; never log raw request content, authorization, or transcript path.

- [ ] **Step 4: Add a narrow CLI entrypoint**

The executable portion reads only non-secret environment variable names already supported by local staging (`STAGING_BASE_URL`, a scoped test-project ID, and optional authorization). It must refuse production-like `NODE_ENV` and missing scope. Emit one redacted JSON result file path supplied by `--output`.

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run tests/runtime/codex-integration-proof.test.ts tests/runtime/codex-hook-client.test.ts tests/runtime/codex-capture.test.ts`

Expected: PASS, including redaction, duplicate/idempotency, cross-scope denial, queued, failed, and completed-state cases.

### Task 3: Staging and browser proof integration

**Files:**
- Modify: `scripts/staging-validation.mjs`
- Create: `tests/e2e/codex-integration-proof.spec.ts`
- Modify: `playwright.config.ts` only if the dedicated test-project identity requires explicit test-only environment wiring.

**Interfaces:**
- Consumes: `CodexProofResult` from Task 2 and the canonical Docker/PostgreSQL staging configuration.
- Produces: explicit `PASS`, `QUEUED`, or `FAIL` check output; browser assertions against authenticated scoped proof results.
- Used by: Task 4 evidence and promotion decision.

- [ ] **Step 1: Write a failing browser proof**

```ts
test('dedicated Codex proof displays scoped durable capture without leaking redacted content', async ({ page }) => {
  await page.goto('/sandbox/operator');
  await expect(page.getByText('Codex integration proof')).toBeVisible();
  await expect(page.getByText('Completed')).toBeVisible();
  await expect(page.getByText('[REDACTED_SECRET]')).toHaveCount(0);
});
```

Cover Chromium and mobile; check 375/768/1440 layouts, keyboard focus, reduced motion, and serious/critical axe results.

- [ ] **Step 2: Run the browser proof to verify it fails**

Run: `E2E_BASE_URL=http://127.0.0.1:3028 npx playwright test tests/e2e/codex-integration-proof.spec.ts --project=chromium --project=mobile --workers=1`

Expected: FAIL because no dedicated proof result exists in the staging/operator surface.

- [ ] **Step 3: Extend staging validation with the proof runner**

Invoke the Task 2 runner after the existing import lifecycle check. Treat `queued` as an explicit non-promotion result, fail on redaction/scope/readback/worker failure, and pass only a completed durable proof. Keep the existing health, worker, and provenance checks.

- [ ] **Step 4: Add the smallest authenticated operator read-only surface needed by the browser proof**

Follow existing server-derived scope and redaction patterns. Do not use query-string authority, client-injected credentials, or browser-local data as proof. Render `queued`, `completed`, `unavailable`, `failed`, and `unauthorized` explicitly.

- [ ] **Step 5: Run focused verification**

Run: `npm run staging:validate`

Expected: all existing checks plus the Codex proof pass against rebuilt local PostgreSQL staging; record exact results and evidence limits.

- [ ] **Step 6: Run serial browser verification**

Run: `E2E_BASE_URL=http://127.0.0.1:3028 npx playwright test tests/e2e/codex-integration-proof.spec.ts --project=chromium --project=mobile --workers=1`

Expected: PASS with no serious/critical axe violations at required viewports. This is local staging browser evidence, not production proof.

### Task 4: Candidate assembly and promotion handoff

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
- Create: `docs/superpowers/handoffs/2026-10-10-oarc-release-preparation-next-chat.md`
- Create: `docs/benchmarks/release-candidate-manifest.json` only from the Task 1 read-only command
- Create: `docs/benchmarks/codex-integration-proof.json` only from a completed Task 2 local-staging proof

**Interfaces:**
- Consumes: manifest from Task 1, proof result from Task 2, staging/browser results from Task 3.
- Produces: a human-reviewable candidate file manifest, exact branch tips, validation matrix, remaining holds, and a command-by-command promotion runbook.
- Used by: the explicit user authorization to create `backup`, push `trial`, and promote `main`.

- [ ] **Step 1: Write the failing documentation checklist test or validation script**

Create a focused test or Node assertion that rejects a candidate handoff missing a candidate commit hash, `oarc/main` and `oarc/V1` tips, backup reference, manifest path, Codex proof state, staging outcome, browser outcome, or remaining evidence holds.

- [ ] **Step 2: Run it to verify it fails before the handoff exists**

Run: `npx vitest run tests/runtime/release-candidate-handoff.test.ts`

Expected: FAIL because the required handoff fields do not exist.

- [ ] **Step 3: Create the candidate handoff and roadmap entry**

Record only observed results. Clearly separate `IMPLEMENTED`, `TESTED`, `LOCALLY VERIFIED`, and `BROWSER VERIFIED`; list deployment, provider, live connector, and production as pending unless directly exercised.

- [ ] **Step 4: Run release-candidate validation**

Run: `npx vitest run tests/runtime/release-candidate-handoff.test.ts && npm test && npm run typecheck && git diff --check`

Expected: PASS; any existing warnings/skips are documented verbatim.

- [ ] **Step 5: Stop for explicit promotion authorization**

Present the exact candidate file list, candidate commit, current `oarc/main`/`oarc/V1` tips, `backup` target, `trial` target, manifest, test outputs, staging outputs, browser outputs, and remaining holds. Do not create branches, commit, push, tag, or deploy until the user explicitly authorizes that exact operation.

### Task 5: Authorized Git migration and release candidate publication

**Files:**
- No product-code changes.
- Modify only the reviewed candidate files selected by Task 4.

**Interfaces:**
- Consumes: explicit user authorization, Task 4 candidate manifest/handoff, verified checks, and an approved candidate file list.
- Produces: an auditable candidate commit, `oarc/backup`, `oarc/trial`, and optionally a reviewed creation or fast-forward of `oarc/main` from an explicitly selected source commit.

- [ ] **Step 1: Re-read authorization and remote state immediately before mutation**

Run: `git status --short`, `git ls-remote --heads oarc`, and the Task 1 manifest command.

Expected: current state matches the reviewed manifest; otherwise stop and report drift.

- [ ] **Step 2: Create a scoped candidate commit**

Use only reviewed pathspecs. Inspect `git diff --cached --check` and `git diff --cached --name-only` before committing. Never stage `.firecrawl/`, runtime databases, logs, raw transcripts, or unrelated user files.

- [ ] **Step 3: Create recovery and trial refs**

Create `backup` from the recorded recovery commit and `trial` from the audited candidate commit. Push each with explicit refspecs to `oarc`; never force-push.

- [ ] **Step 4: Verify remote refs and candidate checkout**

Run: `git ls-remote --heads oarc` and clone or worktree-checkout the pushed `trial` commit. Repeat the selected unit/type/staging/browser gates from Task 4 against that exact commit.

- [ ] **Step 5: Stop for explicit main-promotion authorization**

Report exact `backup` and `trial` remote hashes, verification output, and any failures. Do not alter `oarc/main` without a new explicit user instruction.

## Plan self-review

- Spec coverage: Tasks 1 and 5 cover recoverable branch preparation; Tasks 2 and 3 cover isolated Codex proof and staging/browser gates; Task 4 records evidence and blocks promotion until explicit authorization.
- Step scan: each task defines concrete files, interfaces, failing tests, commands, and a mutation checkpoint. The sole operator-only actions are explicitly deferred behind user authorization.
- Type consistency: Task 2 defines `CodexProofConfig`, `CodexProofResult`, and `runCodexIntegrationProof`; Task 3 consumes that exact result. Task 1 defines `ReleaseCandidateManifest`; Task 4 consumes it.
- Review focus: dirty manifests, remote divergence, redaction/transcript leakage, idempotency, and queued/failed workers are each covered in Tasks 1–3.
- Proportion: the plan remains implementation-level without embedding full production code; it separates independently reviewable Git, capture, staging, documentation, and promotion gates.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-10-oarc-release-preparation.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — a fresh implementer/reviewer cycle per task. Best for the high-risk Git and staging boundaries.
- **Native** — I implement tasks in this session with one final whole-branch review. Faster, but relies on a single implementation context until final review.

For this plan I recommend **Subagent-driven**, because the plan crosses Git recovery, scope security, Docker/PostgreSQL staging, and a Codex integration boundary where an independent review gate is valuable.
