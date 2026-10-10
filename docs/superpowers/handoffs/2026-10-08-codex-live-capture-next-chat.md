# Ray Sandbox OARC — Codex Live-Capture Handoff

Date: 2026-10-08  
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`  
Product: Ray Sandbox OARC  
Purpose: Continue live Codex capture, benchmark, browser E2E, and production-readiness validation in a new chat.

## Start here

Read these documents first:

- `docs/superpowers/PROJECT-CORE-HEART.md`
- `docs/superpowers/blueprints/2026-10-08-tier1-competitive-upgrade-blueprint.md`
- `docs/superpowers/codex-host-integration.md`
- this handoff

Verify the branch and dirty worktree before editing:

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
git status --short --branch
```

## Current runtime

The verified local application runs at:

- `http://127.0.0.1:3017/sandbox`
- `http://127.0.0.1:3017/sandbox/benchmarks`
- `http://127.0.0.1:3017/sandbox/memory-audit`

Start it from this checkout:

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
$env:PORT = '3017'
npm run dev
```

The current `.env.local` contains local-only scope configuration:

```env
APEX_DATABASE_URL=postgresql://postgres:5993@127.0.0.1:5432/ray_sandbox_oarc
APEX_AUDIT_TENANT_ID=tenant-local
APEX_AUDIT_BANK_ID=oarc-bank
APEX_AUDIT_PROJECT_ID=project-1
APEX_ALLOW_DEV_PRINCIPAL=true
```

`APEX_ALLOW_DEV_PRINCIPAL=true` is only for isolated local verification. Remove it before any production or shared deployment and use a real scoped authentication mechanism.

## What is verified

- `/api/v1/health`, `/sandbox`, `/sandbox/benchmarks`, and `/sandbox/memory-audit` return HTTP `200` on port `3017`.
- PostgreSQL is reachable and the canonical schema is ready.
- Audit scope resolves to `tenant-local / oarc-bank / project-1`.
- A synthetic Codex event was accepted through `POST /api/project-memory/codex-event`.
- Synthetic event result: authenticated, normalized, persisted, and queued.
- The event appears in the PostgreSQL-backed **Run event history**.
- The React `Date` rendering failure in the audit page was fixed by serializing `occurredAt` with `toISOString()`.
- Durable project-event history now reconciles process-local capture counters for the audit UI. Persisted events display as `queued` rather than incorrectly showing `uncaptured`.
- Targeted verification passed: typecheck plus capture-status, audit, and repository tests (`10/10`).
- The local application is working for the synthetic event path.

## Important current state

The audit page should show approximately:

```text
Project project-1
Capture queued (0 processed / 0 failed)
1 event in Run event history
0 canonical records for the synthetic connectivity event
1 expected cross-platform capture gap
```

The synthetic message is intentionally only a connectivity probe. It does not contain a decision, requirement, risk, or follow-up, so it is not expected to create a governed canonical memory record.

## What remains

### 1. Real Codex host capture

The repository boundary is implemented, but the surrounding Codex desktop conversation is not automatically intercepted by this app. A host-side connector must call the typed client in `lib/runtime/codex-hook-client.ts`:

- `sendCodexMcpCall`
- `sendCodexToolResult`

The host must supply stable IDs, redacted content, authentication, retry behavior, and the exact tenant/bank/project scope. Do not claim live capture from the synthetic PowerShell event alone.

### 2. Worker completion evidence

The UI correctly reports `queued` when durable event history is present but downstream processing is not proven in the current request. Verify worker processing, extraction, and governance with a meaningful event containing a project decision or requirement. Confirm whether a canonical record is created and whether the status changes to `processed`.

### 3. Matched live benchmark

Run the same redacted corpus in:

1. `without-memory`
2. `local-memory`
3. `postgres-memory`
4. `manifest-memory`

Keep model, prompt version, temperature, tool budget, timeout, and corpus fixed. Record answer score, citation precision, unsupported-claim rate, latency, queue delay, token counts, persistence, and capture status. Submit through `/api/project-memory/benchmark` using the typed host adapter or `npm run benchmark:submit`.

### 4. Authenticated browser E2E

The repository has manual/AX-tree browser evidence but no complete Playwright/axe harness. Add it only after choosing a test authentication method. Cover benchmark submission/export and audit capture/history at 375px, 768px, and 1440px with keyboard and axe checks.

### 5. Production validation

Still pending: staging deployment, migration rehearsal, load test, queue/worker observation, backup/restore drill, rollback test, and production monitoring/redaction validation.

## Recommended next sequence

1. Verify the current server and PostgreSQL availability.
2. Run a meaningful synthetic Codex event through the dev principal and verify extraction/worker completion.
3. Inspect `docs/superpowers/codex-host-integration.md` and connect a real host event adapter.
4. Capture a small redacted live Codex corpus in the isolated `tenant-local / oarc-bank / project-1` scope.
5. Run and persist the matched four-mode benchmark.
6. Add and execute authenticated Playwright/axe browser tests.
7. Perform staging load, restore, deployment, and rollback validation.
8. Update the Core Heart blueprint and create the next handoff only after new evidence exists.

## Useful commands

Health and route check compatible with Windows PowerShell 5.1:

```powershell
$urls = @(
  'http://127.0.0.1:3017/api/v1/health',
  'http://127.0.0.1:3017/sandbox',
  'http://127.0.0.1:3017/sandbox/benchmarks',
  'http://127.0.0.1:3017/sandbox/memory-audit'
)

foreach ($url in $urls) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    Write-Output "$url => $([int]$response.StatusCode)"
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -ne $webResponse) {
      Write-Output "$url => $([int]$webResponse.StatusCode)"
    } else {
      Write-Output "$url => request failed: $($_.Exception.Message)"
    }
  }
}
```

Local dev-principal headers for a synthetic event:

```powershell
$headers = @{
  'x-dev-subject'   = 'local-codex-test'
  'x-dev-tenant-id' = 'tenant-local'
  'x-dev-scopes'    = 'events:write memory:read memory:write'
}
```

Do not paste authorization tokens into chat, source, screenshots, benchmark artifacts, or logs.

## Preservation rules

- Preserve the large intentional dirty worktree.
- Preserve `.firecrawl/` as untracked.
- Do not run `git reset --hard`, `git checkout --`, `git clean`, broad deletion, or unrelated overwrite.
- Do not create a commit unless explicitly requested.
- Keep secrets out of manifests, audit responses, logs, screenshots, and handoffs.
- Keep all reads and writes tenant/bank/project scoped.
- Do not claim automatic cross-platform or live Codex capture without connector evidence.

## Honest status

```text
Local runtime:                 VERIFIED
PostgreSQL and migrations:     VERIFIED
Synthetic Codex hook:          VERIFIED
Audit event history:           VERIFIED
Audit UI Date crash:           FIXED AND VERIFIED
Durable queued display:        IMPLEMENTED AND VERIFIED
Real Codex host capture:       PENDING
Matched live benchmark:        PENDING
Playwright/axe E2E:            PENDING
Production load/restore:       PENDING
```

No reset, cleanup, unrelated overwrite, or commit was performed for this handoff.
