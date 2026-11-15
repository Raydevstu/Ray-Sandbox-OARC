# SECOND-BRAIN Full Automation — Design Doc

Date: 2026-11-15
Status: Draft for approval (brainstorming output; builder check pending)
Owner: user (kafsh) with OpenCode agent assistance

## Intent and why

The Ray hindsight-memory slice ("SECOND-BRAIN") already stores and retrieves
agent memory well, but day-to-day use is hands-on: per-project env vars,
manual project/bank registration, MCP session juggling, and an empty capture
job template. The goal is that a day-to-day user never thinks about memory:
conversations are captured automatically, relevant memory returns
automatically at the right moment, scoping happens by itself, and monitoring
is one dashboard.

## Goals

- **Auto-capture/retain:** preferences, decisions, and outcomes from agent
  conversations are saved without any "remember this" step.
- **Auto-recall/inject:** relevant memory enters context at session/task
  start (and on demand), not just on keyword search.
- **Scoping & identity:** memory is separated per user/project/agent/session
  automatically (cwd → bank/project), preventing cross-contamination.
- **Monitoring/controls:** the existing dashboard endpoints (audit, review,
  policies, conflicts, status, delete) surface what was stored and why, with
  pause/opt-out per project.
- **Retention & safety:** expiry, dedup, conflict handling, and easy opt-out
  for sensitive data; never store credentials.

## Non-goals

- Replacing OpenCode's existing `opencode-mem` plugin or other memory plugins.
- Production multi-tenant hardening; local dev-principal auth stays.
- Silent injection into ordinary ChatGPT chats (platform does not allow it;
  see Phase 2 for what is possible).
- Mobile clients.

## Anti-goals (failure even if it "works")

- Any manual env-var or registration step left in the per-project flow.
- Cross-project memory leakage (workspace A's context appearing in B).
- Memory writes that include secrets/tokens/passwords.
- Capture that silently fails with no visible status.

## Constraints

- Hub: local slice via docker compose, app on `http://127.0.0.1:3018`,
  Postgres 16 volume; dev principals enabled (`APEX_ALLOW_DEV_PRINCIPAL=true`,
  `APEX_REQUIRE_JWT=false`). Verified running 2026-11-15.
- Tenant `sandbox-tenant` exists; target bank for this workspace is
  `secondbrainog` (created 2026-11-15); project id `SECOND-BRAIN`.
- Host: Windows 11, PowerShell; agents: Hermes, OpenCode, Codex, ChatGPT,
  browser (phase 2).
- OpenCode config schema drift hit during setup: installed CLI rejected
  `permissions/agents/snapshots/update/warming` and earlier `mcp.servers`
  shape; config fixes are hot-reloaded, `/reload` forces full reload.

## Approaches considered

1. **A. Agent-native hub (CHOSEN).** Keep the local slice as the brain; wire
   Hermes/OpenCode/Codex via existing endpoints + hooks; ChatGPT and browser
   as phase 2. Fastest to true automation on 3 of 5 surfaces; reuses
   everything built; self-hosted and private.
   - Tradeoff: ChatGPT/browser are not day-one.
2. **B. Universal capture proxy.** A standalone always-on inbox service with
   per-app adapters. Most uniform, most building; ChatGPT injection still
   constrained regardless. Chosen as the growth path for browser + ChatGPT.
3. **C. Hosted memory (Mem0/Zep-class).** Least building, polished UI, but
   abandons the self-hosted brain, privacy story, and existing dashboard;
   same per-app connector work remains. Rejected.

## Decided how (as agreed in conversation)

### Phase 1 — Approach A (this build)

**D1. One machine-level identity profile (removes env juggling).**
A one-time installer script (user-approved 2026-11-15) writes the machine-level
Windows env values once — `RAY_MEMORY_AGENT_ID`, `RAY_MEMORY_TENANT_ID`,
default scopes `memory:read memory:write events:write`, and endpoint
`http://127.0.0.1:3018` — so MCP `{env:}` header expansion works at session
start. This is a per-computer step, not a per-project one (anti-goal only
bans per-project manual steps). A copy of the values also lives in
`~/.config/opencode/ray-memory.env` for the plugin to read at runtime.
Dynamic per-project values are **derived, not configured**:
- Because `x-dev-allowed-project-ids` is a static header list while projects
  are cwd-derived, the plugin performs recall/capture over **direct REST
  calls** with headers built per-request from the profile file, not through
  the static MCP headers. MCP stays for interactive/lookup use.
- Bank/project resolution reuses the proven `hermes-push` pattern
  (`bankIdForCwd`/`findBankForCwd`, `app/api/v1/memory/hermes-push/route.ts`
  lines ~17–60): cwd → bank match, auto-create when missing, with
  `provenance` recorded as `bank-watch-path`.
- **Non-project cwds are ignored** (user-approved): a cwd is treated as a
  real project only if it shows project markers (`.git`, `.opencode`,
  `package.json`, or similar); temp/home/desktop folders never spawn banks.
- Bank/project resolution reuses the proven `hermes-push` pattern
  (`bankIdForCwd`/`findBankForCwd`, `app/api/v1/memory/hermes-push/route.ts`
  lines ~17–60): cwd → bank match, auto-create when missing, with
  `provenance` recorded as `bank-watch-path`.
- Explicit per-project override stays possible via a small
  `.opencode/ray-memory.json` (e.g. `{ "bank": "secondbrainog",
  "project": "SECOND-BRAIN", "capture": true|false }`).

**D2. OpenCode hook/plugin (auto-capture + auto-inject).**
An OpenCode plugin (joined with existing plugin setup) that:
- on session start / first user prompt: POST recall against the hub
  (`/api/v1/memory/recall` with project filters, budget `low`,
  `max_tokens` ≤ 1500 per the engine's context-pack cap) and inject the
  returned context pack into the session as background context;
- on session end (and on meaningful turn completion): POST a batched
  conversation export to `/api/project-memory/import` with
  `platform: "opencode"`, `conversationId` = session id, `workspacePath`
  = cwd; the hub's existing pipeline (async dispatcher, hash dedup,
  capture-status) does the rest;
- respects `capture: false` opt-out and enforces two-layer redaction
  (strengthened per builder check): (a) tool outputs sourced from
  secret-bearing paths (`.env`, key files, credentials dirs) are excluded
  wholesale before content is even inspected; (b) content lines matching
  credential patterns (token/key/password shapes) are skipped. Never send
  message content flagged as secrets.

**D3. Hermes (verify, then enable — config change authorized).**
The slice already runs with a Hermes state DB and exposes
`/api/v1/memory/hermes-push`. Work: confirm the Hermes-side push is enabled
and pointed at 3018; **if it is not enabled, a minimal Hermes config change
to turn it on is in scope** (user-approved 2026-11-15).

**D4. Codex (wire existing endpoint).**
`/api/project-memory/codex-event` already accepts `mcp-call`/`tool-result`
envelopes with capture-status. Work: a Codex hook (AGENTS.md/hooks) that
posts tool activity envelopes per session; project id from cwd via D1
resolution.

**D5. Monitoring/controls (surface, don't rebuild).**
The dashboard already exposes audit, review, policies, proposals, conflicts,
operations, status, delete, export (`app/api/project-memory/*`). Work: a
single "SECOND-BRAIN" card/section linking these, plus per-project capture
status from `getCaptureStatus()`/`/api/project-memory/status`.

**D6. Retention & safety defaults.**
- Default policy: raw conversation events retained 90 days, distilled facts
  kept; dedup via existing hash dedupe; conflicts surfaced via existing
  conflicts endpoint rather than auto-resolved.
- **Auto-expiry sweeper is in scope as new hub-side code** (user-approved
  2026-11-15): the retention schema exists (policies `retentionDays`,
  migration 0007 soft-delete column) but no enforcement job does. Add a
  lightweight scheduled sweeper (interval job in the slice) that soft-deletes
  expired raw events; distilled facts are exempt.
- Opt-out: per-project `.opencode/ray-memory.json` `capture:false`, and a
  global kill switch in the profile file.
- Redaction: per D2 — source-path exclusion plus content regex skip;
  hub-side existing policy endpoints for review/purge.

**D7. Fix the MCP wiring that stalled in setup.**
OpenCode `mcp.servers["hindsight-memory"]` (V2 shape per current docs) with
dev-principal headers sourced from the D1 profile; `/mcps` shows connected
state; if the installed CLI still rejects the shape, pin/upgrade CLI version
before building hooks on it.

### Phase 2 — grow into B (separate follow-up, not this build)

- **Browser:** extension that captures page-level facts (and supports
  recall-injection while browsing) posting to the same import endpoint
  (`platform: "opencode"` semantics or a new `browser` platform value).
- **ChatGPT:** (a) custom GPT with Actions calling retain/recall; and/or
  (b) scheduled sync exporting ChatGPT conversations → import endpoint
  (`platform: "chatgpt"` is already accepted by the import schema).
- Honest limit: ordinary ChatGPT chats cannot receive silent injection.

## What's left to the builder

- Exact OpenCode plugin hook event names and batching cadence.
- Recall prompt/injection format (concise background block, no raw dumps).
- Redaction regex list (credential patterns).
- Dashboard card placement/UX details.
- Codex hook implementation details per Codex's current hook API.
- Test tooling choices (vitest exists in the slice; Playwright config exists).

## Builder-check resolutions (2026-11-15)

The reviewer subagent raised 9 questions. Resolved as follows:

- **Profile → MCP headers (Q1):** one-time machine-level Windows installer
  approved for static identity; dynamic cwd-derived scoping goes over direct
  REST from the plugin (see D1). MCP's static `x-dev-allowed-project-ids`
  header is not relied on for dynamic projects.
- **Retention enforcement (Q2):** sweeper is new hub-side code, in scope
  (D6); `lib/runtime/retention/` exists and exports `retainMemory`, so the
  MCP route import is valid — no build break.
- **Agent identity (Q3):** `atlas` remains the OpenCode identity (user
  decision); Hermes/Codex captures use their own per-surface ids
  (`hermes`, `codex`) so audit/review can attribute sources.
- **Bank auto-create (Q4):** non-project cwds ignored via project-marker
  check (D1).
- **Redaction bar (Q5):** two-layer — secret-bearing source paths excluded
  wholesale + content regex skip (D2). DoD #5 fake-token test is the bar.
- **Version floor (Q6):** target installed OpenCode 1.18.13; plugin code
  written defensively against plugin API changes.
- **Hermes scope (Q7):** config change to enable push is authorized if
  needed (D3).
- **Backfill (Q8):** one-time import of this design conversation via
  `hindsight-memory-capture.mjs` is in scope so DoD #1 passes on the first
  fresh session.
- **Codex fallback (Q9):** AGENTS.md-instructed posting fallback acceptable
  if no hook API exists in Codex 0.147.0; capture-status must make any gap
  visible (anti-goal: no silent failure).

## Verification plan (definition of done)

1. Fresh OpenCode session in `D:\Projects\Secondosaistudioog` with **no
   manual env steps**: recall injection appears at session start (memory
   about SECOND-BRAIN decisions from this conversation).
2. After a working session, `/api/project-memory/status` (or dashboard)
   shows captured events for project `SECOND-BRAIN`, bank `secondbrainog`;
   dashboard audit/review can view and delete a stored item.
3. Opt-out respected: with `capture:false`, no new events recorded.
4. Cross-contamination check: a second project's session does not receive
   SECOND-BRAIN memories (filters verified).
5. No secrets in stored content (redaction test with a fake token).
6. Codex and Hermes sessions produce events visible in the same dashboard.
