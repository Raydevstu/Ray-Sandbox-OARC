# SECOND-BRAIN Full Automation — Design Doc v2

**Date:** 2026-11-15 · **Status:** Draft for approval (v2 — external review applied, claims re-verified locally) · **Owner:** kafsh
**Supersedes:** v1 (`2026-11-15-second-brain-full-automation-design.md`)

**Codebase pin (F1):** Build against **`Fusion`** (`origin/Fusion@82586ac` + local unpushed work, local HEAD `3f3ce22` at time of writing). `main` is the browser-only simulation and must never be the build target. **Gate M0:** push the current local slice, record the exact commit here, and either merge Fusion → main or rename branches so `origin/HEAD` is the real hub.

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

1. Which plugin API generation does 1.18.13 expose — server `ctx.session.hook` or legacy V1? (Adapter decides at runtime; probe M0-6.)
2. Does Codex 0.147.0 `SessionStart` support context append? (Fallback ladder in D4 covers either answer; probe M0-7.)
3. Does `/api/project-memory/import` run the async distiller for `platform:"opencode"` end-to-end? (Probe M0-4; D3 fix depends on it.)
4. Dashboard card placement/UX. (Builder's call.)

The M0 checklist and implementation skeletons (shared core, Codex hook, OpenCode plugin) live in `2026-11-15-second-brain-m0-checklist.md` alongside this doc; `VERIFY(M0-n)` markers in the skeletons map to checklist items.
