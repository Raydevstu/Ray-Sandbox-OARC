# SECOND-BRAIN Full Automation — Design Doc v2

**Date:** 2026-11-15 · **Status:** Draft for approval (v2 — external review applied, claims re-verified locally) · **Owner:** kafsh
**Supersedes:** v1 (`2026-11-15-second-brain-full-automation-design.md`)

**Codebase pin (F1):** Build against **`Fusion`** (`origin/Fusion@82586ac` + local unpushed work, local HEAD `3f3ce22` at time of writing). `main` is the browser-only simulation and must never be the build target. **Gate M0:** push the current local slice, record the exact commit here, and either merge Fusion → main or rename branches so `origin/HEAD` is the real hub.

**M0 pin (recorded 2026-11-15):** pushed as `oarc/Fusion@d842190` (docs commit). `origin` (huri70459-png/hindsight-sandbox) rejects this machine's credentials (403, authenticated as Raydevstu); **`oarc` (Raydevstu/Ray-Sandbox-OARC) is the push target**. Tool versions: OpenCode CLI `1.18.13`, Codex CLI `0.147.0`. Branch decision: `main` stays retired for the hub (browser simulation); documented here rather than merged — merging is the user's call.

**Review provenance (verified locally 2026-11-15):** F1 confirmed (`app/api`, `docker-compose.yml`, `lib/server/hermes-push.ts` absent from `origin/main` tree; present on `Fusion`); F2 confirmed (`hermes-push/route.ts:42` returns `ok:true, state:'localStorage-only'`; `:118/:130` report `connected:true` without a pool); F3 confirmed (`structureTranscript` → `saveDistilledFacts` at `:67–74` stores the raw transcript as distilled facts); F9 confirmed (`scripts/hindsight-memory-capture.mjs` absent locally too; `hermes-push.mjs`, `hermes-automation-smoke.mjs`, `hermes-mcp-proxy.mjs`, `codex-host-bridge.mjs`, `postgres-backup.mjs`, `postgres-smoke-test.mjs` all present). F4/F5/F7 are external-source claims gated behind M0 probes (M0-5/6/7) rather than trusted.

## 1. Intent, goals, non-goals, anti-goals

Unchanged from v1 (see v1 doc §Intent/Goals/Non-goals), plus one anti-goal **[NEW]** (F2):

> Reporting success (`ok: true`, `connected: true`) when nothing was persisted is a failure, even if every other feature works.

## 2. Constraints (verified 2026-11-15)

- Hub: local slice via docker compose, `http://127.0.0.1:3018`, Postgres 16 volume, dev principals (`APEX_ALLOW_DEV_PRINCIPAL=true`, `APEX_REQUIRE_JWT=false`). Tenant `sandbox-tenant`, bank `secondbrainog`, project `SECOND-BRAIN`.
- Host: Windows 11 / PowerShell. Agents: Hermes, OpenCode (target 1.18.13), Codex (0.147.0), ChatGPT + browser (phase 2).
- **[CHANGED] Codex ≥0.145 ships native hooks** (`hooks.json` or `[hooks]` in `config.toml`), enabled by default, gated by a per-hook-hash trust review (`/hooks`). `SessionEnd`/`Interrupt` timeout: 1 s default, **3 s max**. `async: true` hooks observe but cannot block. *(Verify in M0-7.)*
- **[CHANGED] OpenCode plugin API has two generations.** Current server API: `ctx.session.hook("prompt" | "context" | "compaction" | …)`, `ctx.tool.hook("execute.before"/"execute.after")`; legacy V1: `event`, `chat.message`, `tool.execute.*`. The plugin must feature-detect (adapter, §D2). Never inject chat messages outside `session.idle`. *(Verify in M0-6.)*
- **[NEW] Existing assets to reuse, not rebuild (F9):** `lib/server/hermes-push.ts` (cwd→bank helpers), `lib/engine/project-detector.ts`, `lib/engine/auto-import.ts` (hash dedup), `lib/engine/context-pack.ts` (hard 1500-token cap), `projects/` 60 s watcher loop, `plugins/` + `services/memory-os/` (fail-open hooks), `scripts/hermes-push.mjs`, `scripts/hermes-automation-smoke.mjs`, `scripts/hermes-mcp-proxy.mjs`, `scripts/codex-host-bridge.mjs`, `scripts/postgres-backup.mjs`, `scripts/postgres-smoke-test.mjs`, vitest + Playwright + CI gate. One capture pipeline; no parallel importer.

## 3. Architecture [NEW — explicit data flow]

```
OpenCode plugin ─┐                          ┌─ Postgres 16 (evidence, facts, policies)
Hermes push ─────┤→ redact → spool(JSONL) →─┤→ /api/project-memory/import → dispatcher
Codex hooks ─────┘   (client, L1+L2)  flush │→ hub-side redact (L3) → hash dedup → distill
                                            └─ retention sweeper (soft-delete → purge)
Recall: session/task start → POST /recall (bank+project filters, ≤1500 tok, ≤800 ms, fail-open)
        → ephemeral system-context injection (never persisted → never re-captured)
Control: profile kill switch > project capture:false > default on
Observe: capture-status state machine → SECOND-BRAIN dashboard card
```

## 4. Decisions

### D1 — Identity & scoping **[CHANGED]**

One-time machine-level installer (approved), idempotent, User-scope env + profile file:

```powershell
# install-ray-memory.ps1 — run once per machine
[Environment]::SetEnvironmentVariable('RAY_MEMORY_ENDPOINT','http://127.0.0.1:3018','User')
[Environment]::SetEnvironmentVariable('RAY_MEMORY_AGENT_ID','atlas','User')
[Environment]::SetEnvironmentVariable('RAY_MEMORY_TENANT_ID','sandbox-tenant','User')
[Environment]::SetEnvironmentVariable('RAY_MEMORY_SCOPES','memory:read memory:write events:write','User')
# Profile (plugin runtime source of truth) — ACL to current user only
New-Item -ItemType Directory -Force "$HOME\.config\opencode" | Out-Null
@'
{ "endpoint":"http://127.0.0.1:3018", "tenantId":"sandbox-tenant", "agentId":"atlas",
  "scopes":["memory:read","memory:write","events:write"],
  "killSwitch":false, "captureEnabled":true, "recallEnabled":true,
  "recall":{"budget":"low","maxTokens":1500,"timeoutMs":800},
  "spool":{"maxEvents":5000,"maxBytes":52428800} }
'@ | Set-Content "$HOME\.config\opencode\ray-memory.env"
```

Note: env changes reach *new* terminals only; the installer says so. Per-project manual steps remain banned.

**[NEW] Kill-switch semantics (F12):** `killSwitch:true` disables capture **and** recall on all surfaces, stops the flusher, and surfaces "paused" on the dashboard; it does not delete data or the spool. Precedence: `killSwitch` > project `capture:false` > defaults.

**[NEW] cwd → bank resolution, normalized (F8):**
1. Normalize: absolute path, forward slashes, strip trailing separator; **comparison key is lowercased** (Windows); display form preserved.
2. Git worktrees resolve to the main repo root (one bank per repo); monorepos: nearest marker wins; sub-project banks only via explicit override.
3. Project markers, in order: `.git` > `.opencode` > `package.json` > `pyproject.toml`/`Cargo.toml`/`go.mod`. No marker → `skipped_nonproject`, never auto-create.
4. Ignore list: home root, Desktop, Downloads, `%TEMP%`, drive roots.
5. Match via existing `findBankForCwd`/`bankIdForCwd` (**in `lib/server/hermes-push.ts`** — citation fixed from v1), auto-create with provenance `bank-watch-path`; resolution cached 5 min per cwd.
6. Override: `.opencode/ray-memory.json` → `{ "bank":"secondbrainog", "project":"SECOND-BRAIN", "capture":true }` (typo fixed).
7. **Server-side enforcement:** recall/import routes must apply tenant+bank+project filters from the authenticated scope, not from client-supplied filters alone. Client REST headers are a hint; the server is the boundary.

### D2 — OpenCode plugin **[CHANGED]**

**Hook adapter (feature-detect at load; F5):**

| Concern | Current server API | Legacy V1 fallback |
|---|---|---|
| Recall injection | `ctx.session.hook("context", e => e.system.push({type:"text",text:pack}))` — ephemeral, per model call, never persisted | `chat.message` parts on first prompt; **never** inject messages outside `session.idle` |
| Turn capture | `ctx.session.hook("compaction", …)` spool pre-compaction transcript + `session.idle` event | `event` hook on `session.idle` / `message.updated` |
| Tool activity | `ctx.tool.hook("execute.after", …)` (metadata + redacted result) | `tool.execute.after` |
| Session end | best-effort spool + flush trigger | same |

**Recall:** once per session (and on demand via MCP tool), `POST /api/v1/memory/recall` with resolved bank/project, budget `low`, `max_tokens ≤ 1500`, **timeout 800 ms, fail-open** (session proceeds without memory; status `recall_skipped_hub_down`). Injection format: one fenced `<<ray-memory>>` block, distilled facts only, each with date + provenance id; no raw dumps. **[NEW] Echo guard (F6):** injected content is ephemeral (never in stored history) *and* its content hashes are registered so any capture path excludes them. DoD #9 tests that memory doesn't compound across sessions.

**[NEW] Durable capture — outbox pattern (F6):**
- Capture triggers: turn completion (debounced), pre-compaction, session idle, process exit (best-effort).
- Append redacted batches to `%LOCALAPPDATA%\ray-memory\spool\opencode\<sessionId>.jsonl` **before** any network attempt.
- Flusher: on plugin load (replays crashed sessions), every 60 s, and on idle. Exponential backoff 1 s → 5 min. Idempotency key `sha256(tenant|bank|sessionId|turnRange|contentHash)`; hub hash-dedup makes replays safe.
- Export: `POST /api/project-memory/import`, `platform:"opencode"`, `conversationId = sessionId`, `workspacePath = cwd`.
- **Success criteria (F2):** `ok:true` **and** `imported > 0` **and** state ≠ `localStorage-only`. Anything else = failure → keep in spool, status `spooled_offline` / `failed_retrying`.
- Spool caps: 5 000 events / 50 MB → drop-oldest with a **visible** `dropped_spool_overflow` counter (never silent).

**Redaction:** three layers, §D6.

### D3 — Hermes **[CHANGED]** (config change authorized)

Verify push is enabled and pointed at 3018 using `scripts/hermes-automation-smoke.mjs`; **evidence = rows in Postgres**, not HTTP 200. **[NEW] Route fixes required before enabling (F2, F3):**
1. No-pool path returns an explicit degraded state (`ok:false, state:"no-store"`); `GET` reports `connected:false`. Dashboard renders it red.
2. Pushed transcripts enter the **same import/distill pipeline** as OpenCode — raw transcript stored as raw evidence (90-day retention), distilled facts produced by the distiller. No more raw-transcript-as-distilled-fact (which bypassed retention).
3. Hub-side redaction (L3) applies to this route too.
4. `authorize()` runs against the **resolved** bank scope, not the `push-inbox` fallback.

### D4 — Codex **[REWRITTEN]** (F4)

Native hooks, not AGENTS.md posting. One-time trust review via `/hooks` is a machine-level step (allowed). Hook entry: `~/.codex/hooks.json` → `codex-hook.mjs` with modes `--start | --tool | --flush | --spool` (skeleton in the M0 file).

- `--tool` posts `mcp-call`/`tool-result` envelopes to `/api/project-memory/codex-event` (agent id `codex`), async so zero added latency; `--spool` is **disk-only** (SessionEnd hard cap 3 s); the shared flusher delivers.
- Recall at `SessionStart`: verify context-append support on 0.147.0; if unsupported, hook writes the pack to `.codex/ray-context.md` and AGENTS.md instructs reading it (fallback rung 2). `notify` (`agent-turn-complete`) is fallback rung 3 for turn capture; AGENTS.md-instructed posting is last resort, only for pre-0.145 builds. Every rung reports through capture-status — a gap is visible, never silent.
- Reuse `scripts/codex-host-bridge.mjs` as the hook script's base.

### D5 — Monitoring **[EXPANDED]**

Single SECOND-BRAIN card linking audit / review / policies / proposals / conflicts / operations / status / delete / export. **[NEW] Capture-status state machine (F2):**
`captured → distilled` · `skipped_optout` · `skipped_redaction` · `skipped_nonproject` · `spooled_offline` · `failed_retrying` · `dropped_spool_overflow`.
Card shows per project × agent: last capture time, spool depth, last error, opt-out badge, sweeper last run, hub store mode (`postgres` vs degraded). Any non-green state is visually loud.

### D6 — Retention & safety **[EXPANDED]**

**Sweeper (new hub code, approved; F11):** every 6 h ± 15 min jitter; `pg_try_advisory_lock` prevents overlap; batches of 500; soft-deletes raw events/evidence older than policy `retentionDays` (default 90, migration 0007 column); **hard purge after a 30-day grace**; distilled facts exempt — valid only because D3 stops laundering raw transcripts into facts. Runs `scripts/postgres-backup.mjs` before its first purge. Logs `{scanned, softDeleted, purged, durationMs}` to operations. Coordinates with (does not duplicate) `decayScores`/`consolidateNightly`.

**Redaction — three layers (F10), redact *before* hashing:**
- **L1 source exclusion (client):** drop tool I/O touching `.env*`, `*.pem`, `id_rsa*`, `.ssh/`, `.aws/`, `.git-credentials`, `credentials*`, `.npmrc` — wholesale, before inspection.
- **L2 content scan (client):** rule set below (10 rules + entropy check); matching lines skipped and counted (`skipped_redaction`), never sent. Applies to tool **inputs and outputs**, user and assistant text.
- **L3 hub-side (server):** same shared module re-scans every import/push/codex-event — defense in depth against a misbehaving client.

Rule set (reviewer-reported corpus: 11/11 fake secrets caught, 5/5 benign lines clean incl. a 40-char git SHA; corpus becomes a vitest fixture at M2):

| Rule | Pattern (abridged) |
|---|---|
| aws-access-key | `\b(AKIA\|ASIA\|AIDA\|AROA\|…)[A-Z0-9]{16}\b` |
| github-token | `\b(gh[pousr]_[A-Za-z0-9]{36,}\|github_pat_[A-Za-z0-9_]{20,})\b` |
| llm-api-key | `\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b` |
| slack-token | `\bxox[baprs]-[A-Za-z0-9-]{10,}\b` |
| google-api-key | `\bAIza[0-9A-Za-z_-]{35}\b` |
| jwt | `\beyJ…\.eyJ…\.[A-Za-z0-9_-]{10,}\b` |
| private-key | `-----BEGIN (RSA \|EC \|OPENSSH \|PGP )?PRIVATE KEY-----` |
| url-credentials | `\b[a-z][a-z0-9+.-]*://[^\s/:@]+:[^\s@]+@\S+` |
| secret-assign | `(?i)\b(password\|secret\|token\|api[_-]?key\|authorization)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}` |
| bearer | `(?i)\bbearer\s+[A-Za-z0-9._\-]{16,}` |
| high-entropy | any `[A-Za-z0-9+/=_-]{32,}` token with Shannon entropy > 4.2 (hex git SHAs stay clean) |

**[NEW] Local security posture:** compose publishes `127.0.0.1:3018` only; profile file ACL'd to the user; auth headers never logged; dev-principal headers are authentication, `_meta` session ids are never used for authz.

### D7 — MCP wiring **[CHANGED]** (F7)

Exact current shape — note `oauth: false`, without it OpenCode may attempt OAuth against the header-auth hub:

```jsonc
{ "mcp": { "servers": { "hindsight-memory": {
  "type": "remote",
  "url": "http://127.0.0.1:3018/mcp",
  "oauth": false,
  "timeout": 10000,
  "headers": {
    "x-dev-principal": "{env:RAY_MEMORY_AGENT_ID}",
    "x-dev-tenant-id": "{env:RAY_MEMORY_TENANT_ID}",
    "x-dev-scopes": "{env:RAY_MEMORY_SCOPES}"
  }
} } } }
```

**[NEW] Dynamic scoping for MCP too:** OpenCode sends `_meta["ai.opencode/sessionID"]` on every tool call. Plugin registers `sessionId → {cwd, bank, project}` at session start (small new endpoint `POST /api/project-memory/session-register`); MCP tools resolve scope from that registry. Static `x-dev-allowed-project-ids` is no longer load-bearing for anything. Direct REST remains the primary capture/recall path. Version gate: if 1.18.13 rejects this shape, pin/upgrade CLI **before** building hooks (unchanged), and `opencode plugin check` + `/mcps` must pass in M0.

### D8 — Reliability & failure modes **[NEW]**

| Failure | Behavior | Visibility |
|---|---|---|
| Hub down at session start | Recall skipped ≤800 ms; session unaffected | `recall_skipped_hub_down` badge |
| Hub down mid/post session | Capture spooled; flusher retries with backoff | `spooled_offline`, spool depth on card |
| Crash mid-session | Spool survives; replayed on next plugin load, deduped | `captured` after replay; DoD #7 |
| Postgres down, app up | Import returns degraded, **not** `ok:true` | Card red, `failed_retrying` |
| Spool overflow | Drop-oldest + counter | `dropped_spool_overflow` |
| Config/API drift | Adapter feature-detects; refuses loudly, never no-ops | Startup error + status |
| Non-project cwd | No bank, no capture | `skipped_nonproject` |
| Concurrent sessions, same project | Per-session `conversationId`; idempotency keys prevent double-writes | — |

### D9 — Performance budgets **[NEW]**

Recall p95 ≤ 800 ms hard-timeout, fail-open · capture fully off the prompt path (async hooks / spool) · flusher batch ≤ 100 events · sweeper batch 500, off-peak jitter · context pack ≤ 1500 tokens (engine cap).

### D10 — Repo & release hygiene **[NEW]** (F1, F9)

Push local slice to `Fusion`; pin commit + OpenCode/Codex versions in this doc; CI gate (`.github/workflows`) must run the new unit suites; backfill: `hindsight-memory-capture.mjs` does not exist locally or on origin — build it on `scripts/hermes-push.mjs` / the import endpoint, idempotent, provenance `backfill` (M6 task; probe at M0-8).

## 5. Rollout milestones **[NEW]**

| Gate | Scope | Exit criteria |
|---|---|---|
| M0 | Repo truth (D10), versions pinned, MCP shape verified | CI green on the pinned commit; `/mcps` connected |
| M1 | Installer + profile + resolution (D1) | Unit tests: normalization, markers, worktree, ignore list |
| M2 | OpenCode capture + spool + status (D2, D5) | DoD 2, 3, 7, 8 |
| M3 | Recall injection + echo guard (D2) | DoD 1, 4, 9 |
| M4 | Hermes route fixes + Codex hooks (D3, D4) | DoD 6, 11 |
| M5 | Sweeper + redaction L3 (D6) | DoD 5, 10 |
| M6 | Dashboard card + backfill + docs | DoD 12; all green |

**Rollback:** profile `killSwitch:true` (instant, all surfaces) → disable plugin → Codex `/hooks` disable → compose down. Data removal via existing delete/purge endpoints.

## 6. Definition of done v2

v1 items 1–6 kept (fresh-session recall in `D:\Projects\Secondosaistudioog`; captured events visible + deletable; opt-out respected; cross-project isolation; fake-token redaction; Codex+Hermes events in dashboard), plus:

7. **Crash recovery:** kill OpenCode mid-session → restart → spool replays, events appear exactly once.
8. **Hub-down degradation:** compose stopped → session starts in ≤800 ms without memory, status `spooled_offline`; compose up → spool drains.
9. **No echo loop:** injected pack never re-captured; stored fact count stable across 3 idle sessions.
10. **Sweeper:** seeded 91-day-old raw events soft-deleted, distilled intact, ops-log entry; second run is a no-op.
11. **Degraded truth:** Postgres stopped → push/import report degraded, dashboard shows disconnected (never `ok:true`/`connected:true`).
12. **Windows identity:** same project via different case/separators/worktree → one bank; second project receives zero SECOND-BRAIN facts even with client-supplied filters tampered (server-side enforcement).

**Test tooling:** vitest (normalization, resolution, redaction corpus, idempotency, echo guard) · integration against a compose test profile (import→status→recall filters, sweeper with seeded clock) · Playwright (card, delete flow, opt-out badge) · `scripts/hermes-automation-smoke.mjs`, `scripts/postgres-smoke-test.mjs`, new `scripts/ray-automation-smoke.mjs` wiring DoD 7–12 into CI.

## 7. Phase 2 (unchanged, one addition)

Browser extension + ChatGPT custom-GPT Actions / scheduled export, same import endpoint; ordinary ChatGPT chats still cannot receive silent injection. **[NEW]** Add `"browser"` to the platform enum **now** (one-line schema change) to avoid a migration later.

## 8. Open questions for the builder (reduced; answered by M0 probes)

**M0-4 answers (verified live 2026-11-15, contracts in `docs/contracts/`):**

1. **Header names (corrects D7 and the M0 checklist):** the dev principal header is **`x-dev-subject`** (`lib/runtime/auth/principal.ts:12`), not `x-dev-principal`; `x-dev-allowed-project-ids` is **comma-separated** (`principal.ts:17`). Optional `x-dev-bank-id` / `x-dev-project-id` constrain the principal.
2. **Recall contract:** `readProjectScope` requires `tenantId`+`bankId`+`projectId` together (body or headers; `api-handlers.ts:47-57`) — missing any one is a 403. Body field is `bankId` (not `bank_id`); `limit` or `maxTokens` accepted. Postgres path returns `data.facts[]` (`entity/category/content/confidence/importance/occurrences`) ranked from the `facts` table — **there is no `contextPack` field**; `core.recallPack` joins `facts[].content` lines.
3. **Import contract:** envelope is `z.strict()` and requires `tenantId`, `bankId`, `exportedAt` (ISO), `sourceReference` (min 1), `messages[]`. Persists to **`project_events`** (`ConversationImported` + `ProjectWorkerCompleted`).
4. **Open question 3 answered — CRITICAL GAP:** the import pipeline does **NOT** produce distilled facts (verified: `distilled_facts` count 0 after a verified import; worker completes in ~8 ms; `facts` untouched). Recall reads `facts`, so imported conversations are **invisible to recall** until an import→distill→facts bridge exists. Task 8's "same import/distill pipeline" therefore includes building that bridge.
5. **Live evidence for F3:** existing `secondbrainog` recall results are full tool outputs and file dumps stored as facts — the raw-transcript-as-fact problem is already in production data.
6. **Store truth:** hermes-push GET reports `store:"postgres"`, connected, 28 banks; pushes arriving today. M0-2 PASS.

1. **M0-6 ANSWERED (verified live in a headless `opencode run` with a probe plugin):** OpenCode 1.18.13 exposes the **legacy V1 plugin API only** — probe log shows `ctxKeys: [client, project, worktree, directory, experimental_workspace, serverUrl, $]` with `ctx.session.hook` and `ctx.tool.hook` both `undefined`. Working hooks: `event` (bus events `session.created`, `session.updated`, `session.status`, `session.diff`, `message.updated`, `message.part.updated`, `plugin.added`, …) and `chat.message` (input keys `sessionID, agent, model, messageID, variant`; output keys `message, parts`). The adapter implements the legacy path first: recall injection via **`experimental.chat.system.transform`** (`output.system.push` — ephemeral per model request, migration table maps it to V2 `ctx.session.hook("context")`), capture via `event` (`session.idle`) + `experimental.session.compacting` + `tool.execute.after`. V2 feature-detect stays in place for future CLI upgrades.
2. **M0-7 ANSWERED (partially, by discovery):** Codex capture **already exists** — the installed `ray-memory-os` 0.1.0 plugin is hooked into Codex (`SessionStart`/`UserPromptSubmit`/`Stop`/`PostCompact`/`SessionEnd` confirmed firing today in `%LOCALAPPDATA%\RayMemory\hook.log`) with its own SQLite durable outbox (episodes/captures with `sync_status`/`attempts`/`leased_until`), idempotency keys, redaction, and `codex-event`-shaped payloads. Its env (`RAY_MEMORY_ENDPOINT`/`TENANT_ID`/`BANK_ID`) was never set, so **267 episodes sit queued with zero synced** (silent-failure anti-goal, live). Task 7 becomes: fix the existing plugin (cwd-derived bankId + machine env), not build a parallel hook. The SessionStart `additionalContext` question is deferred to the existing plugin's upgrade path (its `mcp_dispatch`/context mechanism) rather than a new hook.
3. **M0-5 ANSWERED:** the hub MCP endpoint requires custom `initialize` params (see §M0-4 answers); Task 10 adds a compatibility path deriving context from dev headers + session-register. OpenCode 1.18.13's config schema puts servers under `mcp.<name>` each with `enabled` (verified: `mcp.servers` map rejected with "Missing key mcp.servers.enabled"; hot-reload confirmed the fixed shape connects).
4. Dashboard card placement/UX. (Builder's call.)

The M0 checklist and implementation skeletons (shared core, Codex hook, OpenCode plugin) live in `2026-11-15-second-brain-m0-checklist.md` alongside this doc; `VERIFY(M0-n)` markers in the skeletons map to checklist items.

## 9. Verification evidence (continuation, 2026-11-15/16 local)

**Commits/pushes (oarc/Fusion):** `efeabe7` (Task 13 card+status relay), `e565d45` (Task 14 backfill/smoke/CI), `66a780e` (import→distill→facts bridge + local compose audit scope `APEX_AUDIT_TENANT_ID=sandbox-tenant`, `APEX_AUDIT_BANK_ID=secondbrainog`, `APEX_AUDIT_PROJECT_ID=SECOND-BRAIN`), `e928a19` (import workspacePath: unknown derivations advisory for authorized scopes). Rebuilt/redeployed app via `docker compose up -d --build app` after `66a780e` and again after `e928a19` (app healthy, postgres healthy).

### Gap closure: deployed admin endpoints (configured + operable)
- **Config:** `docker-compose.yml` app env now sets `APEX_AUDIT_TENANT_ID/BANK_ID/PROJECT_ID` for local deployment (staging/production already required them).
- **`GET /api/project-memory/status` (post-rebuild):** `ok:true`, enriched shape with `capture`, `clientStatuses:[]`, `retentionSweeper:null`, `storeMode:"postgres"` (in-memory counters reset on restart as expected).
- **`GET /api/project-memory/operations` (authenticated dev principal, jobs:claim):** `ok:true`, returns `jobs`, `capture`, `retentionSweeper`, derived status/activeFailure/historicalLastError (live DB state reflected honestly; endpoint operable).
- **`POST /api/project-memory/sweeper-run` (authenticated, jobs:claim):** `ok:true`, evidence `{"scanned":0,"softDeleted":0,"purged":0,"durationMs":87,...,"status":{"...","at":"2026-11-15T22:06:22.371Z"}}` (initial) and `{"scanned":0,"softDeleted":0,"purged":0,"durationMs":81,...,"at":"2026-11-15T22:14:06.388Z"}` (post-restore). No aged rows existed to delete (expected).

### DoD 1 (import→distill→facts visibility, recall)
- **Fix:** `/api/project-memory/import` now distills accepted imported conversation content into canonical `facts` via `distillSession` + `saveDistilledFacts` (idempotent upsert, best-effort bridge, does not fail successful event import). This closes the M0-4/open-question-3 gap ("import pipeline does NOT produce distilled facts; recall reads facts").
- **Backfill (idempotent):** `node scripts/ray-backfill.mjs` run with `conversationId=second-brain-design-2026-11-15`, `platform=opencode`, `provenance=backfill`, `workspacePath=D:\Projects\Secondosaistudioog`, `tenant/bank/project=sandbox-tenant/secondbrainog/SECOND-BRAIN` → `ok:true`, `imported:6 accepted:6`; re-run safe (dedup/accepted behavior observed). Post-fix re-run after rebuild populated distilled facts.
- **DB evidence:** `facts` contains `df-d-projects-secondosaistudioog-44ou4x` (entity `D:\Projects\Secondosaistudioog`, category `workflow`, source evidence `import:opencode`, claim includes `opencode import: second-brain-design-2026-11-15 (backfill:docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md)` and design v2 snippets/DoD content including sweeper/91-day/degraded-truth/windows-identity references). Direct probe import (`conversationId dbg-2026`) also produced `df-second-brain-yv4wmz`, confirming bridge.
- **Recall evidence (scoped POST `/api/v1/memory/recall`, bank+project+tenant):** targeted query for `second-brain-design-2026-11-15 backfill full automation design v2 retention sweeper` returned the backfilled design fact as top result (`traceId pg-1794780648388` context in local run). **Caveat:** "fresh OpenCode session in D:\Projects\Secondosaistudioog" end-to-end client injection was not interactively exercised from this agent session; hub recall visibility (required substrate) is verified.

### UI tests (Playwright)
- **Attempted:** `npx playwright test tests/e2e/second-brain-card.spec.ts tests/e2e/project-dashboard.spec.ts --project=chromium`.
- **Result:** **blocked in this environment** — Playwright `webServer` (`npm run dev -p 3000`, reuseExistingServer) timed out; dev server showed Next/webpack/watchpack module-resolution issues (`pg`/`fs`/`pg-native` trace, `EINVAL lstat D:\Documents and Settings`/`pagefile.sys`, lockfile-root warning) and did not become ready. Specs and route-mocked test implementations exist; run requires a healthy Playwright/dev-server environment.

### DoD 11 (Postgres-down degraded truth) — partial live probe
- Stopped Postgres (`docker compose stop postgres`, restarted/restored after): `GET /api/v1/memory/hermes-push` → `{"ok":false,"state":"failed","error":"getaddrinfo ENOTFOUND postgres","retryable":true}` (no `connected:true`); `GET /api/project-memory/operations` → `{"ok":false,"error":"Connection terminated due to connection timeout"}`; `GET /api/project-memory/status` → `ok:true` envelope but `storeMode:"degraded"` with capture state preserved in-process (not claiming healthy store). After restart, `status` returned `storeMode:"postgres"` and `sweeper-run` succeeded. Evidence is partial (targeted endpoints), not a full dashboard-render/Postgres-down E2E assertion.

### Smoke
- `node scripts/ray-automation-smoke.mjs --local` → PASS (17/17). `npx tsc --noEmit` passed for fix commits.

### Remaining manual/live/destructive or environment-blocked items (not claimed complete)
- **Playwright e2e green run:** rerun in healthy dev-server environment.
- **DoD 7:** crash recovery/exactly-once spool replay (stop hub mid-capture, restart, drain, assert stable counts/no duplicates).
- **DoD 8:** hub-down degradation ≤800ms + `spooled_offline` + restart drain.
- **DoD 9:** no echo loop over 3 idle sessions with injection (fact-count stability).
- **DoD 10:** seeded 91-day-old raw events soft-deleted/purged-after-grace, distilled intact, ops-log entry, backup-first, second run no-op (no 91-day candidates present at probe time).
- **DoD 11:** full degraded-truth coverage including dashboard disconnected state and all push/import routes under Postgres-down conditions.
- **DoD 12:** windows identity same-bank (case/separators/worktree) and tampered-filter isolation end-to-end with server-side enforcement evidence.
- **Final human checks:** dashboard card green on live data, opt-out via scratch `.opencode/ray-memory.json` (DoD 3), fake-token end-to-end (DoD 5), fresh OpenCode session recall UX in `D:\Projects\Secondosaistudioog` (DoD 1 client flow), then `finishing-a-development-branch` integration steps.

**Preserved/uncommitted (untouched):** `mcp-server/dist/index.js`, `scripts/hermes-mcp-proxy.mjs`, `scripts/install-ray-memory.ps1`, `.env.opencode.example`, `.opencode/`, `test-results/.last-run.json`, deleted `test-results/tm046-db.png|tm047.png|tm061.png|tm071.png|tm072.png`.
