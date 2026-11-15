# SECOND-BRAIN Full Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Ray hindsight-memory hub ("SECOND-BRAIN") fully automatic for a day-to-day user: auto-capture from OpenCode/Hermes/Codex with durable spooling, auto-recall injection, zero per-project setup, honest failure states, 90-day auto-expiry, and one dashboard control card.

**Architecture:** One capture pipeline (all agents → client-side redact → on-disk JSONL spool → hub import → dedup/distill → Postgres), one recall path (fail-open POST /recall → ephemeral system-context injection with echo guard), server-side scope enforcement, a retention sweeper, and a dashboard status card. Client code (shared core, OpenCode plugin, Codex hook) lives in `plugins/ray-memory/` in the repo; a one-time installer copies it to the machine-level config dir.

**Tech Stack:** TypeScript/Next.js (hub, existing), Node ≥18 ESM zero-dependency client core, vitest (`tests/runtime/`), Playwright (`tests/e2e/`), PowerShell installer, Docker compose Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md` (design) + `docs/superpowers/specs/2026-11-15-second-brain-m0-checklist.md` (M0 probes and approved skeletons — the plan references, not repeats, them). Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`, branch `Fusion`.

## Global Constraints

Every task implicitly includes these, copied verbatim from the spec:

- Build target: branch `Fusion`. Never build against `main` (browser-only simulation).
- Hub endpoint `http://127.0.0.1:3018`; tenant `sandbox-tenant`; workspace bank `secondbrainog`; project id `SECOND-BRAIN`.
- Dev-principal headers: `x-dev-principal`, `x-dev-tenant-id`, `x-dev-scopes` (names re-verified at M0-4 against `lib/runtime/auth`).
- Success = **persisted**, not HTTP 200: `ok:true` AND `imported > 0` AND state ≠ `localStorage-only` (spec D2/F2).
- Redact **before** hashing. Three layers: L1 secret-path exclusion, L2 content scan (client), L3 hub-side re-scan (spec D6).
- Fail-open everywhere: recall timeout 800 ms hard cap, session proceeds without memory (`recall_skipped_hub_down`); hooks never block or throw to callers; Codex hooks always exit 0.
- Performance budgets: recall ≤800 ms p95; capture off the prompt path; flusher batch ≤100 events; sweeper batch 500; spool caps 5 000 events / 50 MB drop-oldest with visible counter (spec D9).
- Agent ids: OpenCode → profile `agentId` (`atlas`); Codex → `codex`; Hermes → `hermes`.
- Never inject chat messages outside `session.idle` (legacy path); ephemeral `context` hook preferred (spec D2/F5).
- Echo guard: injected pack hashes registered locally; any capture path excludes them (spec D2/F6).
- Non-project cwds never auto-create banks; no capture (`skipped_nonproject`). Kill-switch precedence: `killSwitch` > project `capture:false` > defaults on (spec D1).
- Client dep rule: `plugins/ray-memory/` is Node ≥18 standard library only — zero npm dependencies.
- Repo test commands: `npm test` (vitest), `npm run typecheck`, `npm run test:e2e` (Playwright).
- Worktree rule: if `.git` is a file, resolve to the common repo root — one bank per repo (spec D1.2).

## Review Focus

Input classes the spec implies but no single task's happy path exercises; each is pinned by the named test in its owning task:

1. **Hub down mid/post-session** → capture must spool locally and drain with backoff, never lose events. Test: `flushSpool` failure/backoff/replay in Task 4; live DoD 8 in Task 14.
2. **Secrets in tool *inputs*** (a write to `.env`, a curl with a Bearer header) → L1 path check and L2 content scan must skip before anything is hashed or sent. Test: redaction corpus, input-direction cases, in Task 4 and Task 9.
3. **Windows path identity drift** (case, separators, trailing slash, worktrees) → same project must resolve to one bank. Test: `projectScope` normalization matrix in Task 4; server-side tamper test in Task 11.
4. **Postgres down, app up** → routes must report degraded truth, never `ok:true`/`connected:true`. Test: hermes-push route degraded states in Task 8; DoD 11 in Task 14.
5. **Echo loop** (remembered text re-captured as new memory, compounding across sessions) → injected pack hash excluded from every capture path. Test: `echoHas` exclusion in Task 4; DoD 9 live in Task 14.

---

### Task 1: M0-A — Repo truth: push Fusion, pin commit

**Files:**
- Modify: `docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md` (header pin line)

**Interfaces:**
- Produces: pinned commit SHA recorded in the design doc header; `origin/Fusion == local HEAD`. Later tasks and CI run against this SHA.

- [ ] **Step 1: Commit the design docs** (currently untracked) on `Fusion`:

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add docs/superpowers/specs/2026-11-15-second-brain-*.md
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add docs/superpowers/plans/2026-11-15-second-brain-full-automation.md
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "docs: second-brain full automation design v2, M0 checklist, plan"
```

Do **not** stage unrelated local modifications (`mcp-server/dist/index.js`, `scripts/hermes-mcp-proxy.mjs`, `.opencode/`, `.env.opencode.example`) — they are the user's working tree; leave them.

- [ ] **Step 2: Push and pin**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" push origin Fusion
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" rev-parse HEAD
```

Expected: push succeeds; note the SHA. If push fails on auth, stop and report — do not switch branches or force-push.

- [ ] **Step 3: Record the SHA** in the design doc header pin line (`...local HEAD 3f3ce22 at time of writing` → replace with the pushed SHA and date). Also record OpenCode and Codex versions (`opencode --version`, `codex --version`) in the doc's Constraints section.

- [ ] **Step 4: Branch decision recorded** — append one line to the design doc §D10 stating whether `Fusion` was merged to `main` or `main` is documented as retired; the merge itself is the user's call, not this task's.

- [ ] **Step 5: Commit the doc update**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "docs: pin pushed Fusion commit + tool versions"
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" push origin Fusion
```

---

### Task 2: M0-B — Endpoint contract capture

**Files:**
- Create: `docs/contracts/import.json`, `docs/contracts/recall.json`, `docs/contracts/status.json`, `docs/contracts/codex-event.json`
- Modify: design doc §8 (answers to open questions 1–3)

**Interfaces:**
- Produces: real request/response JSON for the four endpoints. Tasks 6–13 consume these exact field names; wherever a skeleton line is marked `VERIFY(M0-4)`, this task's output finalizes it.

- [ ] **Step 1: Ensure stack is up**

```powershell
docker compose -f "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice\docker-compose.yml" up -d
docker compose -f "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice\docker-compose.yml" ps
```

Expected: app container healthy on 3018.

- [ ] **Step 2: Probe hermes-push GET** (store truth check, M0-2):

```powershell
$h = @{ "x-dev-principal"="atlas"; "x-dev-tenant-id"="sandbox-tenant"; "x-dev-scopes"="memory:read memory:write events:write" }
Invoke-RestMethod "http://127.0.0.1:3018/api/v1/memory/hermes-push" -Headers $h | ConvertTo-Json -Depth 5
```

Expected: `data.store -eq "postgres"`. If `localStorage-only`, fix compose before anything else and record why.

- [ ] **Step 3: Probe import** with a 2-message fake conversation (`platform:"opencode"`, `conversationId:"m0-probe"`, `workspacePath:"D:\Projects\Secondosaistudioog"`), then GET status, then recall with `bank_id:"secondbrainog"` / `project_id:"SECOND-BRAIN"`. Save each request+response pair as the `docs/contracts/*.json` files (format: `{ "request": {...}, "response": {...} }`).
- [ ] **Step 4: Verify distillation** — status for the probe events must show distilled facts appearing (answers open question 3). Record the answer in design doc §8.
- [ ] **Step 5: Verify header names + codex-event envelope** against `lib/runtime/auth` (header names) and `app/api/project-memory/codex-event/route.ts` (envelope fields `kind`, `tenantId`, `bankId`, `projectId`, `conversationId`, `messageId`, `timestamp`). Record in design doc §8. Clean up the `m0-probe` conversation via the existing delete endpoint.

- [ ] **Step 6: Commit contracts**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add docs/contracts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "docs: M0 endpoint contract captures"
```

---

### Task 3: M0-C — MCP shape, plugin API, Codex hooks probes

**Files:**
- Modify: `C:\Users\kafsh\.config\opencode\opencode.jsonc` (MCP block, then revert to pre-probe state if it changes nothing else)
- Create (temporary, deleted after): `%TEMP%\ray-probe.js` per M0-6
- Create: `~/.codex/hooks.json` pointing at a trivial logging script (replaced by Task 7's real hook)

**Interfaces:**
- Produces: which OpenCode plugin API generation 1.18.13 exposes (V2 `ctx.session.hook` vs legacy V1); whether MCP `oauth:false` remote shape connects (`/mcps`); whether Codex 0.147.0 `SessionStart` `additionalContext` reaches the model. Recorded in design doc §8; Tasks 6–7 branch on these answers only at runtime (adapter), so both outcomes remain valid.

- [ ] **Step 1: MCP shape probe** — add the D7 `mcp.servers["hindsight-memory"]` block (with `oauth:false`, `url:"http://127.0.0.1:3018/mcp"`), run `/reload`, check `/mcps`. Pass = connected + tools listed. If the CLI rejects the shape, stop: pin/upgrade the OpenCode CLI now and record the working version, per spec D7 version gate.
- [ ] **Step 2: Plugin API probe** — drop the M0-6 `ray-probe.js` into the plugins dir, start an OpenCode session, send one prompt, use one tool, read `%TEMP%\ray-probe.log`, delete the probe.
- [ ] **Step 3: Codex hooks probe** — install a minimal `SessionStart` hook that appends a line to `%LOCALAPPDATA%\ray-memory\ray-memory.log`, run a Codex session, trust via `/hooks`, confirm the log line; then ask the model what background context it received and record whether `additionalContext` is visible (M0-7).
- [ ] **Step 4: Record all three answers** in design doc §8; commit:

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "docs: M0 probe answers (plugin API gen, MCP shape, codex sessionstart)"
```

---

### Task 4: Shared client core (`core.mjs`) — profile, scoping, redaction, spool, flusher

**Files:**
- Create: `plugins/ray-memory/package.json` (`{"name":"ray-memory","type":"module","main":"index.js"}`), `plugins/ray-memory/core.mjs`
- Test: `tests/runtime/ray-memory-core.test.ts`

**Interfaces:**
- Produces (used by Tasks 6, 7, 14 — signatures fixed by the approved skeleton in the M0 file §3):
  `loadProfile()`, `authHeaders(profile, agentId, scope?)`, `normalizeCwd(cwd) -> {display, key}`, `projectScope(cwd) -> {skip?, cwd, root?, bank?, project?, capture}`, `isSecretPath(s)`, `redactText(text) -> {text, skipped}`, `redactValue(v)`, `sha256(s)`, `idempotencyKey(profile, bank, sessionId, range, content)`, `echoAdd(agent, hash)`, `echoHas(agent, hash)`, `postJson(url, body, headers, timeoutMs)`, `spoolAppend(agent, sessionId, envelope, profile)`, `makeSend(profile, agentId) -> async (envelope) -> {ok, ...}`, `flushSpool(agent, profile, {deadlineMs, send})`, `recallPack(profile, agentId, scope, query) -> {text, hash} | null`, `memoryBlock(pack)`, `log(agent, msg)`, `writeStatus(agent, state, extra)`.
- Consumes: contract field names from Task 2 (recall request/response keys); header names verified at M0-4.

- [ ] **Step 1: Write the failing test** — `tests/runtime/ray-memory-core.test.ts`, importing from `../../plugins/ray-memory/core.mjs`. Cover exactly:
  1. **Redaction corpus:** the 11 fake-secret lines (one per rule table row in spec D6: AWS key, `ghp_` token, `sk-` key, `xoxb-` token, `AIza` key, JWT, PEM header, `https://user:pass@host`, `password: hunter2ccccccc`, `Bearer abcdef1234567890abc`, 40-char high-entropy non-hex token) each cause `redactText` to drop the line (`skipped === 1`); the 5 benign lines stay (plain sentence, 40-char lowercase-hex git SHA, short words containing "token" without assignment, URL without credentials, code line with the word "key" in prose). Assert `redactValue` recurses into nested objects/arrays.
  2. **L1 paths:** `isSecretPath` true for `.env`, `server.pem`, `id_rsa`, `.ssh/config`, `.aws/credentials`, `.git-credentials`, `.npmrc`, `credentials.json`; false for `env.ts`, `environment.ts`.
  3. **Scoping matrix:** `normalizeCwd` maps `D:\Projects\X\`, `d:/projects/x`, `D:/Projects/X` to one key; `projectScope` returns `skip:"skipped_nonproject"` for `$HOME`, Desktop, Downloads, `os.tmpdir()`, `C:/`, and for a marker-less temp subdir; walks up to the nearest marker for a nested dir; reads `.opencode/ray-memory.json` override (`capture:false` → `skip:"skipped_optout"`; `bank`/`project` honored); worktree: `.git` as a *file* containing `gitdir: .../worktrees/wt` resolves `root` to the main repo dir.
  4. **F2 success semantics:** `makeSend` returns `ok:false` when the response is HTTP 200 with `state:"localStorage-only"`, and when `imported:0` on an `/import` route; `ok:true` only for `ok:true` + `imported>0` + non-degraded state. (Mock `fetch`.)
  5. **Spool + flusher:** `spoolAppend` writes JSONL before any network; `flushSpool` retries failed lines (kept in file), applies backoff (second immediate call returns `deferred`), resets on success, removes the file when empty, respects `killSwitch` (returns `skipped:"killSwitch"`), and respects `deadlineMs`.
  6. **Echo guard:** `echoAdd` then `echoHas` true for the same hash, false otherwise; ring buffer capped at 500.
  7. **Idempotency:** same inputs → same key; different tenant/bank/session/content → different keys.
  8. **Fail-open timing:** `postJson` aborts at `timeoutMs` (mock a never-resolving fetch) and returns `{ok:false}`; `recallPack` returns `null` on timeout/error/missing pack, never throws.
- [ ] **Step 2: Run to verify failure** — `npm test -- tests/runtime/ray-memory-core.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `core.mjs`** from the approved skeleton in M0 file §3, with the M1 worktree TODO resolved (parse `gitdir:` pointer, resolve to the repo root). Finalize every `VERIFY(M0-4)` line (recall field names, header names) against `docs/contracts/`. Keep zero dependencies; `makeSend` implements the F2 persisted-success rule; `enforceCaps` writes `dropped_spool_overflow` via `writeStatus` when dropping; `log()`/`writeStatus()` never include auth headers or their values (spec D6 security posture).
- [ ] **Step 4: Run test to pass** — `npm test -- tests/runtime/ray-memory-core.test.ts`. Expected: PASS. Also `npm run typecheck` (the .mjs import needs a `allowJs`-compatible path; if tsconfig objects, add a `core.d.ts` shim next to `core.mjs` rather than changing strictness).
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add plugins/ray-memory tests/runtime/ray-memory-core.test.ts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(ray-memory): shared client core - profile, scoping, redaction, spool, flusher"
```

---

### Task 5: One-time installer (`install-ray-memory.ps1`)

**Files:**
- Create: `scripts/install-ray-memory.ps1`

**Interfaces:**
- Produces: machine-level state all later tasks assume — User-scope env (`RAY_MEMORY_ENDPOINT`, `RAY_MEMORY_AGENT_ID=atlas`, `RAY_MEMORY_TENANT_ID=sandbox-tenant`, `RAY_MEMORY_SCOPES`), profile JSON at `$HOME\.config\opencode\ray-memory.env` (exact shape in spec D1), and `plugins/ray-memory/*` copied to `$HOME\.config\opencode\plugins\ray-memory\`.
- Consumes: `plugins/ray-memory/` from Task 4.

- [ ] **Step 1: Write the installer** — idempotent (safe to re-run; overwrites its own outputs only, never user files outside its paths): sets the four User-scope env vars only if absent-or-different, writes the profile JSON (with `killSwitch:false`, `captureEnabled:true`, `recallEnabled:true`, recall `maxTokens:1500`/`timeoutMs:800`, spool caps), ACLs the profile to the current user, copies the plugin folder, and prints a "new terminals only" notice. Do not modify `opencode.jsonc` (MCP block stays a manual/user-visible step per Task 3's probe).
- [ ] **Step 2: Verify** — run it twice from a fresh PowerShell; assert: `$env:RAY_MEMORY_ENDPOINT` set in a *new* terminal; profile JSON parses with the D1 values; second run changes nothing (idempotence check by comparing file hashes/ACLs before and after); plugin files present in the global dir.
- [ ] **Step 3: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add scripts/install-ray-memory.ps1
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(ray-memory): one-time machine installer for env, profile, plugin copy"
```

---

### Task 6: OpenCode plugin (`index.js`) — V2/legacy adapter, capture, recall

**Files:**
- Create: `plugins/ray-memory/index.js`

**Interfaces:**
- Consumes: everything from Task 4's core; Task 3's recorded API generation (adapter feature-detects at runtime regardless); Task 2's import contract (`platform:"opencode"`, `conversationId`, `workspacePath`, `messages[]`).
- Produces: export `RayMemory(ctx)` as the auto-discovered plugin; statuses written via `core.writeStatus("opencode", ...)` consumed by Task 13's card; spool files under `%LOCALAPPDATA%\ray-memory\spool\opencode\` consumed by Task 14's smoke tests.

- [ ] **Step 1: Implement from the approved skeleton** (M0 file §5), finalizing `VERIFY(M0-6)` lines against the Task 3 probe log (message shape: `parts[].text`, `info.role`, `info.time.created`; messages-fetch client call). Preserve: ephemeral `context`-hook injection on V2 (never chat messages outside `session.idle` on legacy), capture on `compaction`/`session.idle` + tool `execute.after`, flush-on-load crash replay, 60 s flush interval with `unref`, echo guard on every capture path, L1+L2 redaction before spooling, per-session `capturedUpTo` cursor.
- [ ] **Step 2: Run the full suite** — `npm test` and `npm run typecheck`. Expected: green (plugin is glue; its logic is covered via Task 4).
- [ ] **Step 3: Install and live-probe** — run Task 5's installer (copies the plugin), start an OpenCode session in `D:\Projects\Secondosaistudioog` (a real project cwd): assert a recall block was injected only if the hub has memory (first run may legitimately return none — that's fail-open, check status file says `recall_skipped_hub_down` only if hub is actually down), use one tool, end the session; assert `%LOCALAPPDATA%\ray-memory\spool\opencode\*.jsonl` drained (file gone) and `/api/project-memory/status` shows events for project `SECOND-BRAIN`.
- [ ] **Step 4: Crash-recovery probe (DoD 7 partial)** — with the hub stopped (`docker compose stop app`), run a short session, verify the spool file remains and status shows `spooled_offline`; restart the hub, start a new session, verify the flush-on-load replays and the status returns to `captured` with no duplicate events (check status counts before/after).
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add plugins/ray-memory/index.js
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(ray-memory): opencode plugin - v2/legacy adapter, capture, recall injection"
```

---

### Task 7: Codex hook (`codex-hook.mjs` + `hooks.json`)

**Files:**
- Create: `plugins/ray-memory/codex-hook.mjs`, `~/.codex/hooks.json` (machine config, written by installer in a follow-up step)

**Interfaces:**
- Consumes: Task 4 core (`spoolAppend`, `recallPack`, `redactValue`, `makeSend`, `flushSpool`); Task 2's codex-event contract (envelope `kind:"mcp-call"|"tool-result"`, field names from `docs/contracts/codex-event.json`); Task 3's SessionStart answer (context-append vs fallback rung 2 file).
- Produces: stdin-JSON → stdout-JSON hook, always exit 0; spool under `%LOCALAPPDATA%\ray-memory\spool\codex\`; statuses via `writeStatus("codex", ...)`.

- [ ] **Step 1: Implement from the approved skeleton** (M0 file §4), finalizing `VERIFY(M0-4)`/`VERIFY(M0-7)` lines against the contracts and probe answer: `--start` (recall + optional `additionalContext`, always also write `.codex/ray-context.md` as rung 2), `--tool` (async capture of tool input/output, `mcp__*` → `mcp-call` else `tool-result`, echo guard, redaction), `--flush`, `--spool` (disk-only, zero network, inside the 3 s SessionEnd cap).
- [ ] **Step 2: Simulate without Codex** — pipe fixture JSON into each mode (`node codex-hook.mjs --tool < fixture.json` etc.); assert exit 0, stdout valid JSON `{}`, spool file written for `--tool`, `.codex/ray-context.md` written for `--start` when the hub returns a pack, and that a fake secret in `tool_input` produces `skipped_redaction` status and **no** spool entry.
- [ ] **Step 3: Install hooks.json + live-probe** — write `~/.codex/hooks.json` (M0 file §4 shape, `async:true` on PostToolUse, SessionEnd timeout 2), run a real Codex session in `D:\Projects\Secondosaistudioog`, trust via `/hooks`; assert log lines in `%LOCALAPPDATA%\ray-memory\ray-memory.log`, events visible in `/api/project-memory/status` under agent `codex`.
- [ ] **Step 4: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add plugins/ray-memory/codex-hook.mjs
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(ray-memory): codex native hooks - start/tool/flush/spool, fail-open"
```

---

### Task 8: Hub — fix `hermes-push` silent success and retention bypass (F2, F3)

**Files:**
- Modify: `app/api/v1/memory/hermes-push/route.ts`
- Test: `tests/runtime/hermes-push-route.test.ts` (new; follow the existing route-test pattern in `tests/runtime/api-envelope.test.ts` / `capture-status.test.ts`)

**Interfaces:**
- Produces: `POST` with no pool → `{ ok:false, state:"no-store" }` (HTTP 503); `GET` → `connected:false, store:"no-store"` when no pool, `store:"postgres"` otherwise; pushed transcripts stored as **raw evidence** (retention-eligible) with distilled facts produced by the same distiller used by `/api/project-memory/import` (Task 2 confirmed the pipeline); `authorize()` against the resolved bank scope, not `push-inbox`.
- Consumes: `lib/server/hermes-push.ts` helpers (unchanged signatures); the import pipeline's distiller interface.

- [ ] **Step 1: Write the failing test** — four cases: (a) pool-less POST returns `ok:false, state:"no-store"` and writes nothing; (b) pool-less GET returns `connected:false`; (c) postgres-mode POST persists transcript as raw evidence (retention-eligible: assert the evidence row exists and no distilled fact contains the full raw transcript text) and distilled facts separately; (d) resync deletes prior session facts (existing behavior preserved).
- [ ] **Step 2: Run to verify failure** — `npm test -- tests/runtime/hermes-push-route.test.ts`. Expected: FAIL (current code returns `ok:true, state:"localStorage-only"`).
- [ ] **Step 3: Implement** — replace the no-pool success responses with the degraded contract; route the transcript into the import/distill pipeline; move `authorize()` to the resolved bank. Keep `bankIdForCwd`/`findBankForCwd` behavior untouched.
- [ ] **Step 4: Run to pass** — `npm test -- tests/runtime/hermes-push-route.test.ts` then full `npm test`. Expected: PASS, no regressions.
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add app/api/v1/memory/hermes-push/route.ts tests/runtime/hermes-push-route.test.ts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "fix(hermes-push): honest degraded states; transcripts as raw evidence, not distilled facts"
```

---

### Task 9: Hub — L3 redaction shared module

**Files:**
- Create: `lib/server/redaction.ts`
- Modify: `app/api/project-memory/import/route.ts`, `app/api/v1/memory/hermes-push/route.ts`, `app/api/project-memory/codex-event/route.ts`
- Test: `tests/runtime/redaction-l3.test.ts`

**Interfaces:**
- Produces: `redactIncoming(payload: unknown): { payload, skipped }` in `lib/server/redaction.ts` — same rule set and secret-path list as the client (rules mirrored; a shared fixture file `tests/runtime/fixtures/redaction-corpus.ts` imported by both Task 4's and this task's tests guarantees the rule sets cannot drift).
- Consumes: nothing new; applies before any hashing/dedup/store in the three routes.

- [ ] **Step 1: Write the failing test** — corpus fixture (the 11 secret lines + 5 benign lines + L1 path list from Task 4): posting a payload containing a secret line through each route's handler-level function results in the line being absent from the stored/evidence payload and `skipped` counted; benign content passes through byte-identical; redaction runs **before** the content hash is computed (assert the stored hash equals the hash of the redacted text).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL (no L3 today).
- [ ] **Step 3: Implement** `lib/server/redaction.ts` (mirror of the core rules; single source for the hub) and call it at the top of each of the three routes' intake paths, before hashing/dedup/dispatch. Record `skipped_redaction` into the existing capture-status flow.
- [ ] **Step 4: Run to pass** — `npm test -- tests/runtime/redaction-l3.test.ts` then full `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add lib/server/redaction.ts app/api tests/runtime/redaction-l3.test.ts tests/runtime/fixtures
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(hub): L3 server-side redaction on import, hermes-push, codex-event"
```

---

### Task 10: Hub — session-register endpoint + `browser` platform value

**Files:**
- Create: `app/api/project-memory/session-register/route.ts`
- Modify: the platform enum in the import route's schema (`lib/runtime/schemas.ts` or wherever the import zod schema lives — grep `platforms` in `app/api/project-memory/import/route.ts`)
- Test: `tests/runtime/session-register.test.ts`

**Interfaces:**
- Produces: `POST /api/project-memory/session-register` `{ sessionId, cwd, bank?, project? }` → in-memory (module-level Map, hub process) registry `sessionId → scope`, with TTL eviction (e.g. 24 h); MCP tools resolve scope via this registry when `_meta["ai.opencode/sessionID"]` is present (wire the lookup into the existing MCP tool dispatch — `app/api/mcp/route.ts` — as an optional scope source, never as authz). Import schema accepts `platform:"browser"` (Phase 2 forward-compat, spec §7).
- Consumes: auth headers as everywhere else; `lib/server/hermes-push.ts` resolution when bank/project are omitted.

- [ ] **Step 1: Write the failing test** — register → resolve returns the scope; unknown session → null; entry expires after TTL (fake timers); registry is scoped by tenant (two tenants cannot read each other's registrations); import schema accepts and rejects `platform` values correctly (`"browser"` in, `"bogus"` out).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement** the route (module-level Map + TTL), the MCP scope lookup, and the one-line platform enum addition.
- [ ] **Step 4: Run to pass** — `npm test -- tests/runtime/session-register.test.ts` then full `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add app/api/project-memory/session-register app/api tests/runtime/session-register.test.ts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(hub): session-register endpoint for dynamic MCP scoping; browser platform value"
```

---

### Task 11: Hub — server-side scope enforcement on recall/import

**Files:**
- Modify: `app/api/v1/memory/recall/route.ts` (or its handler in `lib/`), `app/api/project-memory/import/route.ts`
- Test: `tests/runtime/scope-enforcement.test.ts`

**Interfaces:**
- Produces: recall and import apply tenant+bank+project filters **from the authenticated dev-principal scope**, treating client-supplied `bank_id`/`project_id`/`workspacePath` as hints validated against the resolved scope — a client claiming another project's bank gets no cross-project data (and, for import, a 403-class error). Resolution reuses `lib/server/hermes-push.ts` cwd helpers where workspacePath is the only signal.
- Consumes: `lib/runtime/auth` (existing authorization utilities — `tests/runtime/authorization.test.ts` shows the pattern).

- [ ] **Step 1: Write the failing test** — tamper cases: (a) recall with `bank_id` of another bank than the principal's allowed set returns no facts from it; (b) import with a `workspacePath` that resolves to another project's bank is rejected; (c) normal same-project flows still succeed end-to-end; (d) a second project receives zero `SECOND-BRAIN` facts when filters are omitted entirely (defaults derive from workspacePath, never leak).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL (client filters currently trusted).
- [ ] **Step 3: Implement** enforcement at both routes; keep client hints working for the legit case.
- [ ] **Step 4: Run to pass** — `npm test -- tests/runtime/scope-enforcement.test.ts` then full `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add app tests/runtime/scope-enforcement.test.ts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "fix(hub): server-side scope enforcement on recall and import"
```

---

### Task 12: Hub — retention sweeper (soft-delete → purge, backup-first)

**Files:**
- Create: `lib/server/retention-sweeper.ts`
- Modify: wherever the existing lifecycle jobs run (grep `decayScores` / `consolidateNightly` in `lib/` and `projects/` — integrate there; if no shared scheduler exists, add a `POST /api/project-memory/sweeper-run` route that the `projects/` 60 s watcher loop calls on its 6 h cadence with ±15 min jitter)
- Test: extend `tests/runtime/retention.test.ts` (existing file)

**Interfaces:**
- Produces: `runRetentionSweeper({ now }) -> { scanned, softDeleted, purged, durationMs }` — `pg_try_advisory_lock` guarded, batches of 500, soft-deletes raw events/evidence older than the bank's policy `retentionDays` (default 90, migration 0007 column), hard-purges soft-deleted rows older than 30 days grace, distilled facts exempt, runs `npm run db:backup:postgres` before its first purge of a session, logs the counters to the operations endpoint.
- Consumes: existing `lib/server/pg-lifecycle.ts` repository functions; existing policies table.

- [ ] **Step 1: Write the failing test** (seeded clock, test DB or transaction-rollback pattern from `retention.test.ts`): 91-day-old raw events soft-deleted, 89-day-old kept, distilled facts of any age kept, soft-deleted-31-days rows purged, soft-deleted-10-days kept, second immediate run is a no-op (lock or state), backup invoked before first purge (mock the backup call).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement** per the interface above; wire the cadence into the discovered scheduler point.
- [ ] **Step 4: Run to pass** — `npm test -- tests/runtime/retention.test.ts` then full `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add lib/server/retention-sweeper.ts tests/runtime/retention.test.ts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(hub): retention sweeper - advisory lock, soft-delete 90d, purge after 30d grace"
```

---

### Task 13: Dashboard — SECOND-BRAIN status card

**Files:**
- Create: component file per existing dashboard structure (grep the dashboard page under `app/` for the existing card/component pattern; place `SecondBrainCard` beside them)
- Modify: dashboard page to render the card
- Test: `tests/e2e/second-brain-card.spec.ts` (Playwright, follow `tests/e2e/project-dashboard.spec.ts` patterns)

**Interfaces:**
- Consumes: `GET /api/project-memory/status`, `/api/project-memory/audit`, `operations`, plus the client `status.json` surfaces relayed by any existing status route — if no route relays client statuses yet, extend `GET /api/project-memory/status` to include the spool/status data read from `%LOCALAPPDATA%\ray-memory\status.json` **only when the dashboard server runs on the same machine** (it does, localhost) and absent otherwise.
- Produces: card showing per project × agent: last capture time, state badge (`captured` green; `skipped_*` gray; `spooled_offline`/`failed_retrying`/`dropped_spool_overflow`/degraded store red — visually loud per spec D5), spool depth, last error, opt-out badge, sweeper last run, store mode.

- [ ] **Step 1: Write the failing Playwright test** — card renders; with a seeded status the correct badge color/state shows for each state class; links to audit/review/policies/conflicts/delete/export work (existing pages).
- [ ] **Step 2: Run to verify failure** — `npm run test:e2e -- tests/e2e/second-brain-card.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the card component + status relay.
- [ ] **Step 4: Run to pass** — the e2e spec, then `npm run test:e2e -- tests/e2e/project-dashboard.spec.ts` for no regressions. Expected: PASS.
- [ ] **Step 5: Commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add app tests/e2e/second-brain-card.spec.ts
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "feat(dashboard): second-brain status card with capture-state machine"
```

---

### Task 14: Backfill + automation smoke + DoD wiring

**Files:**
- Create: `scripts/ray-backfill.mjs` (idempotent import of this design conversation: provenance `backfill`, `platform:"opencode"`, `conversationId:"second-brain-design-2026-11-15"`, workspacePath `D:\Projects\Secondosaistudioog`)
- Create: `scripts/ray-automation-smoke.mjs` — wires DoD 7–12 into one runnable script (reuse patterns from `scripts/hermes-automation-smoke.mjs`, `scripts/postgres-smoke-test.mjs`)
- Modify: `.github/workflows` gate to run `node scripts/ray-automation-smoke.mjs --local` (offline portions) and `npm test`

**Interfaces:**
- Consumes: everything built in Tasks 4–13; contract files from Task 2.
- Produces: the live evidence for DoD 1–12 (items 1–6 are the manual/live checks from v1 §Verification, items 7–12 scripted here).

- [ ] **Step 1: Write the backfill script** and run it once; verify recall in a fresh OpenCode session in `D:\Projects\Secondosaistudioog` returns SECOND-BRAIN design memories (DoD 1). Re-running must not duplicate (idempotency key + hub dedup — run twice and compare status counts).
- [ ] **Step 2: Write the smoke script** covering: crash recovery (DoD 7 — stop hub mid-capture, restart, drain, assert exactly-once via status counts), hub-down degradation (DoD 8 — recall skip ≤800 ms, `spooled_offline`, drain after up), no echo loop (DoD 9 — fact count stable across 3 idle sessions with injection enabled), sweeper (DoD 10 — seeded 91-day events soft-deleted, second run no-op), degraded truth (DoD 11 — stop Postgres, assert `ok:false`/`connected:false` from both routes), windows identity (DoD 12 — same project via case/separator variants → one bank; tampered filters → zero cross-project facts).
- [ ] **Step 3: Run the smoke script** — all DoD 7–12 assertions green; record output in the design doc's verification section.
- [ ] **Step 4: Wire CI + commit**

```powershell
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" add scripts/ray-backfill.mjs scripts/ray-automation-smoke.mjs .github/workflows
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" commit -m "test: ray-automation-smoke wiring DoD 7-12; backfill script; CI gate"
git -C "D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice" push origin Fusion
```

- [ ] **Step 5: Final human-visible checks** (live, with the user): fresh session in `D:\Projects\Secondosaistudioog` shows recall (DoD 1); dashboard card green (DoD 12's card half); opt-out respected by writing `capture:false` to a scratch project's `.opencode/ray-memory.json` (DoD 3); fake-token test end-to-end (DoD 5).
