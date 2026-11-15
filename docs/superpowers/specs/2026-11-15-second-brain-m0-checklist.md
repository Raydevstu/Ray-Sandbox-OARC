Here are all three, wired together: **M0 checklist** (its item numbers are referenced by `VERIFY(M0-n)` markers in the code, so running M0 tells you exactly which lines to finalize), then the **shared core**, the **Codex hook**, and the **OpenCode plugin skeleton**.

---

## 1. M0 checklist — repo truth & contract probes

Run in order; each item has a hard pass criterion. Record results in design doc §8.

```powershell
# Shared auth headers for all probes (VERIFY names against lib/runtime/auth in M0-4)
$h = @{ "x-dev-principal"="atlas"; "x-dev-tenant-id"="sandbox-tenant"; "x-dev-scopes"="memory:read memory:write events:write" }
```

- [ ] **M0-1 · Push & pin.** `git push origin Fusion; git rev-parse HEAD` → paste SHA into design doc header. Decide `main`'s fate (merge Fusion → main, or document "build target = Fusion"). **Pass:** origin/Fusion == local HEAD; doc pinned.
- [ ] **M0-2 · Stack & store truth.** `docker compose up -d; docker compose ps`, then
  `Invoke-RestMethod "$env:RAY_MEMORY_ENDPOINT/api/v1/memory/hermes-push" -Headers $h`
  **Pass:** `data.store -eq "postgres"` (if `localStorage-only`, fix compose before anything else — remember GET currently lies `connected:true`; that fix lands in M4).
- [ ] **M0-3 · Identity install.** Run `install-ray-memory.ps1` (v2 D1). Open a **new** terminal. **Pass:** `echo $env:RAY_MEMORY_ENDPOINT` prints 3018; `~/.config/opencode/ray-memory.env` exists.
- [ ] **M0-4 · Endpoint contracts.** Save real request/response JSON for `/api/project-memory/import`, `/api/v1/memory/recall`, `/api/project-memory/status`, `/api/project-memory/codex-event` into `docs/contracts/`. Probe import with a 2-message fake conversation (`platform:"opencode"`), then check status. **Pass:** `imported > 0`, status shows the events, **and distilled facts appear** (answers open question 3). Confirm dev-header names + whether `codex-event` accepts `agentId:"atlas"`.
- [ ] **M0-5 · MCP shape.** Add the `mcp.servers["hindsight-memory"]` block (v2 D7, with `oauth:false`), `/reload`, then `/mcps`. **Pass:** connected, tools listed. If rejected → pin/upgrade CLI **now**, not after hooks are built.
- [ ] **M0-6 · Plugin API probe.** Drop this into `~/.config/opencode/plugins/ray-probe.js`, start a session, send one prompt, use one tool:
  ```js
  import fs from "node:fs";
  export const RayProbe = async (ctx) => {
    const log = (x) => fs.appendFileSync(process.env.TEMP + "/ray-probe.log", JSON.stringify(x) + "\n");
    log({ ctxKeys: Object.keys(ctx ?? {}), sessionHook: typeof ctx?.session?.hook, toolHook: typeof ctx?.tool?.hook, client: typeof ctx?.client });
    return { event: async ({ event }) => log({ event: event.type }),
             "chat.message": async (i, o) => log({ chatMessage: true, outKeys: Object.keys(o ?? {}) }) };
  };
  ```
  **Pass:** `ray-probe.log` tells you V2 (`session.hook` is a function) vs legacy V1, and the message-list client shape. Delete the probe after.
- [ ] **M0-7 · Codex hooks.** `codex --version` ≥ 0.145. Install `hooks.json` (below), run Codex, trust via `/hooks`. **Pass:** `--start` fires (log line in `%LOCALAPPDATA%\ray-memory\ray-memory.log`); record whether the returned `additionalContext` is visible to the model (ask it "what background context did you receive?"). If not → fallback rung 2 (`.codex/ray-context.md` + AGENTS.md) is already in the script.
- [ ] **M0-8 · Backfill script.** `Test-Path scripts/hindsight-memory-capture.mjs` → if false (it's absent on origin), log a build task for M6 based on `scripts/hermes-push.mjs`.
- [ ] **M0-9 · CI.** Push triggers `.github/workflows` gate. **Pass:** green on the pinned commit.
- [ ] **M0-10 · Record answers.** Fill design doc §8 (API generation, SessionStart injection, import distillation, header/envelope schemas). **M0 exit.**

---

## 2. Install layout (one directory, one shared core)

```
~/.config/opencode/
  ray-memory.env                    # profile (D1 installer writes this)
  plugins/ray-memory/               # auto-discovered plugin package
    package.json                    # {"name":"ray-memory","type":"module","main":"index.js"}
    core.mjs                        # shared: profile · redaction · spool · flusher
    index.js                        # OpenCode plugin (V2 + legacy adapter)
    codex-hook.mjs                  # Codex hook entry (hooks.json points here)
~/.codex/hooks.json
%LOCALAPPDATA%\ray-memory\          # spool\<agent>\*.jsonl · status.json · ray-memory.log
```

Source of truth: `plugins/ray-memory/` on Fusion; the installer copies it to the global config dir (machine-level, zero per-project steps).

## 3. `core.mjs` — shared module (Node ≥ 18, zero deps)

```js
// core.mjs — profile, scoping, redaction (L1+L2), spool, flusher. Never throws to callers.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export const PROFILE_PATH = path.join(os.homedir(), ".config", "opencode", "ray-memory.env");
export const STATE_DIR = path.join(process.env.LOCALAPPDATA ?? os.homedir(), "ray-memory");
const SPOOL_DIR = path.join(STATE_DIR, "spool");

export function log(agent, msg) {
  try { fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.appendFileSync(path.join(STATE_DIR, "ray-memory.log"), `${new Date().toISOString()} [${agent}] ${msg}\n`);
  } catch {}
}
export function writeStatus(agent, state, extra = {}) {
  try { fs.mkdirSync(STATE_DIR, { recursive: true });
    const p = path.join(STATE_DIR, "status.json");
    let st = {}; try { st = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
    st[agent] = { ...(st[agent] ?? {}), state, at: Date.now(), ...extra };
    fs.writeFileSync(p, JSON.stringify(st, null, 2));
  } catch {}
}

export function loadProfile() {
  let p = {}; try { p = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8")); } catch {}
  return {
    endpoint: p.endpoint ?? process.env.RAY_MEMORY_ENDPOINT ?? "http://127.0.0.1:3018",
    tenantId: p.tenantId ?? process.env.RAY_MEMORY_TENANT_ID ?? "sandbox-tenant",
    agentId:  p.agentId  ?? process.env.RAY_MEMORY_AGENT_ID  ?? "atlas",
    scopes:   p.scopes   ?? (process.env.RAY_MEMORY_SCOPES ?? "memory:read memory:write events:write").split(/\s+/),
    killSwitch: p.killSwitch === true,
    captureEnabled: p.captureEnabled !== false,
    recallEnabled:  p.recallEnabled  !== false,
    recall: { maxTokens: 1500, timeoutMs: 800, ...(p.recall ?? {}) },
    spool:  { maxEvents: 5000, maxBytes: 50 * 1024 * 1024, ...(p.spool ?? {}) },
    features: p.features ?? {},   // e.g. sessionRegister:true once the D7 endpoint ships (M2)
  };
}

export function authHeaders(profile, agentId, scope) {   // VERIFY(M0-4): header names vs lib/runtime/auth
  const h = { "content-type": "application/json",
    "x-dev-principal": agentId ?? profile.agentId,
    "x-dev-tenant-id": profile.tenantId,
    "x-dev-scopes": profile.scopes.join(" ") };
  if (scope?.project) h["x-dev-allowed-project-ids"] = scope.project; // hint only; server enforces (D1.7)
  return h;
}

// ---- cwd → project scope (D1, Windows-normalized) ----
const MARKERS = [".git", ".opencode", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];
export function normalizeCwd(cwd) {
  const clean = path.resolve(cwd ?? process.cwd()).replace(/\\/g, "/").replace(/\/+$/, "");
  return { display: clean, key: clean.toLowerCase() };
}
export function projectScope(cwd) {
  const { display, key } = normalizeCwd(cwd);
  let ov = null; try { ov = JSON.parse(fs.readFileSync(path.join(display, ".opencode", "ray-memory.json"), "utf8")); } catch {}
  if (ov?.capture === false) return { skip: "skipped_optout", cwd: display };
  const homes = [os.homedir(), path.join(os.homedir(), "Desktop"), path.join(os.homedir(), "Downloads"), os.tmpdir()];
  if (!ov && (homes.some((p) => normalizeCwd(p).key === key) || /^[a-z]:\/$/i.test(display)))
    return { skip: "skipped_nonproject", cwd: display };
  let dir = display, marker = null;
  for (;;) {
    marker = MARKERS.find((m) => fs.existsSync(path.join(dir, m)));
    if (marker || dir === path.parse(dir).root) break;
    dir = path.dirname(dir);
  }
  if (!marker && !ov) return { skip: "skipped_nonproject", cwd: display };
  // TODO(M1): worktree — if .git is a file, resolve gitdir → common repo root so worktrees share one bank
  return { cwd: display, root: dir, bank: ov?.bank, project: ov?.project, capture: ov?.capture !== false };
}

// ---- Redaction L1 (paths) + L2 (content). Tested corpus: 11/11 secrets caught, 5/5 benign clean ----
const SECRET_PATH = /(^|[\/\\])(\.env(\.[^\/\\]+)?|[^\/\\]*\.pem|id_rsa[^\/\\]*|\.ssh|\.aws|\.git-credentials|credentials[^\/\\]*|\.npmrc)([\/\\]|$)/i;
export const isSecretPath = (s) => typeof s === "string" && SECRET_PATH.test(s);
const RULES = [
  /\b(?:A3T[A-Z0-9]|AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s@]+@\S+/,
  /\b(?:password|passwd|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}/i,
  /\bbearer\s+[A-Za-z0-9._\-]{16,}/i,
];
function entropy(s) { const c = {}; for (const ch of s) c[ch] = (c[ch] ?? 0) + 1;
  return -Object.values(c).reduce((a, v) => a + (v / s.length) * Math.log2(v / s.length), 0); }
export function redactText(text) {
  const out = []; let skipped = 0;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const hit = RULES.some((rx) => rx.test(line)) ||
      (line.match(/[A-Za-z0-9+/=_-]{32,}/g) ?? []).some((t) => entropy(t) > 4.2);
    if (hit) skipped++; else out.push(line);
  }
  return { text: out.join("\n"), skipped };
}
export function redactValue(v) {
  if (typeof v === "string") return redactText(v).text;
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactValue(x)]));
  return v;
}

// ---- Hashing AFTER redaction; echo guard ----
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const idempotencyKey = (p, bank, sid, range, content) =>
  sha256([p.tenantId, bank ?? "", sid, range, sha256(content)].join("|"));
const echoPath = (agent) => path.join(STATE_DIR, `echo-${agent}.json`);
export function echoAdd(agent, hash) {
  try { fs.mkdirSync(STATE_DIR, { recursive: true });
    let a = []; try { a = JSON.parse(fs.readFileSync(echoPath(agent), "utf8")); } catch {}
    a.push(hash); fs.writeFileSync(echoPath(agent), JSON.stringify(a.slice(-500)));
  } catch {}
}
export function echoHas(agent, hash) {
  try { return JSON.parse(fs.readFileSync(echoPath(agent), "utf8")).includes(hash); } catch { return false; }
}

// ---- HTTP with hard timeout (fail-open) ----
export async function postJson(url, body, headers, timeoutMs = 5000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
  } catch (e) { return { ok: false, status: 0, error: String(e?.name ?? e) }; }
  finally { clearTimeout(t); }
}

// ---- Outbox spool (D2): append before any network; caps drop-oldest with visible counter ----
export function spoolAppend(agent, sessionId, envelope, profile) {
  const dir = path.join(SPOOL_DIR, agent); fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${sessionId}.jsonl`), JSON.stringify(envelope) + "\n");
  enforceCaps(profile);
}
function enforceCaps(profile) {
  try {
    const files = [];
    for (const a of fs.readdirSync(SPOOL_DIR)) {
      const d = path.join(SPOOL_DIR, a); if (!fs.statSync(d).isDirectory()) continue;
      for (const f of fs.readdirSync(d).filter((f) => f.endsWith(".jsonl"))) {
        const p = path.join(d, f), st = fs.statSync(p);
        files.push({ p, t: st.mtimeMs, s: st.size, n: fs.readFileSync(p, "utf8").split("\n").filter(Boolean).length });
      }
    }
    let bytes = files.reduce((a, f) => a + f.s, 0), events = files.reduce((a, f) => a + f.n, 0);
    files.sort((a, b) => a.t - b.t);
    let dropped = 0;
    while ((bytes > profile.spool.maxBytes || events > profile.spool.maxEvents) && files.length) {
      const f = files.shift(); fs.rmSync(f.p); bytes -= f.s; events -= f.n; dropped += f.n;
    }
    if (dropped) writeStatus("spool", "dropped_spool_overflow", { dropped });
  } catch {}
}

// ---- Sender: success means PERSISTED, not HTTP 200 (F2) ----
export function makeSend(profile, agentId) {
  return async (env) => {
    const r = await postJson(profile.endpoint + env.route, env.body, authHeaders(profile, agentId, env.scope), env.timeoutMs ?? 5000);
    const needsImported = env.route.includes("/import");
    const ok = r.ok && r.json?.ok === true && r.json?.state !== "localStorage-only" &&
      (!needsImported || (r.json?.data?.imported ?? 0) > 0);
    return { ok, ...r };
  };
}

// ---- Flusher: replay on load, backoff 1s→5min, deadline-bounded (safe inside Stop hooks) ----
export async function flushSpool(agent, profile, { deadlineMs = 8000, send } = {}) {
  if (profile.killSwitch) return { skipped: "killSwitch" };
  const dir = path.join(SPOOL_DIR, agent); if (!fs.existsSync(dir)) return { flushed: 0 };
  const bp = path.join(dir, "_backoff.json");
  let backoff = { until: 0, delay: 1000 }; try { backoff = JSON.parse(fs.readFileSync(bp, "utf8")); } catch {}
  if (Date.now() < backoff.until) return { deferred: true };
  const start = Date.now(); let flushed = 0, failed = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
    if (Date.now() - start > deadlineMs) break;
    const file = path.join(dir, f), remaining = [];
    for (const line of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      let env; try { env = JSON.parse(line); } catch { continue; }
      const r = await send(env);
      if (r.ok) flushed++; else { remaining.push(line); failed++; }
    }
    if (remaining.length) fs.writeFileSync(file, remaining.join("\n") + "\n"); else fs.rmSync(file);
    if (failed) break; // hub likely down — stop this pass
  }
  const delay = failed ? Math.min(backoff.delay * 2, 300_000) : 1000;
  fs.writeFileSync(bp, JSON.stringify({ until: failed ? Date.now() + delay : 0, delay }));
  writeStatus(agent, failed ? "failed_retrying" : "captured", { flushed, failed });
  return { flushed, failed };
}

// ---- Recall (fail-open, ≤800ms) + injection block ----
export async function recallPack(profile, agentId, scope, query) {
  const body = { query, bank_id: scope.bank, project_id: scope.project, budget: "low", max_tokens: profile.recall.maxTokens }; // VERIFY(M0-4) field names
  const r = await postJson(profile.endpoint + "/api/v1/memory/recall", body, authHeaders(profile, agentId, scope), profile.recall.timeoutMs);
  const text = r.json?.data?.contextPack ?? r.json?.data?.context_pack ?? null; // VERIFY(M0-4)
  return r.ok && text ? { text, hash: sha256(text) } : null;
}
export const memoryBlock = (pack) =>
  `<<ray-memory>>\nRelevant distilled memory (background context; never re-capture this block):\n${pack.text}\n<<end-ray-memory>>`;
```

## 4. `codex-hook.mjs` + `hooks.json`

```js
#!/usr/bin/env node
// codex-hook.mjs — modes: --start | --tool | --flush | --spool
// Contract: JSON on stdin, JSON on stdout, ALWAYS exit 0, never deny (fail-open).
import fs from "node:fs";
import path from "node:path";
import * as core from "./core.mjs";

const AGENT = "codex";
const mode = process.argv[2] ?? "--spool";

function readStdin(timeoutMs = 1500) {
  return new Promise((res) => {
    let d = ""; const t = setTimeout(() => res(d), timeoutMs);
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => { clearTimeout(t); res(d); });
    process.stdin.resume();
  });
}

async function main() {
  const profile = core.loadProfile();
  if (profile.killSwitch) return {};
  let ev = {}; try { ev = JSON.parse(await readStdin()); } catch {}
  const cwd = ev.cwd ?? process.cwd();
  const sessionId = ev["thread-id"] ?? ev.session_id ?? "unknown";
  const scope = core.projectScope(cwd);
  if (scope.skip) { core.writeStatus(AGENT, scope.skip, { cwd }); return {}; }
  const send = core.makeSend(profile, AGENT);

  if (mode === "--start") {
    if (profile.features.sessionRegister) // NEW endpoint ships in M2 (D7); off until then so flusher doesn't retry 404s
      core.spoolAppend(AGENT, sessionId, { route: "/api/project-memory/session-register", scope,
        body: { sessionId, cwd: scope.cwd, bank: scope.bank, project: scope.project } }, profile);
    if (profile.recallEnabled && profile.captureEnabled !== false) {
      const pack = await core.recallPack(profile, AGENT, scope, `session start ${path.basename(scope.root ?? cwd)}`);
      if (pack) {
        core.echoAdd(AGENT, pack.hash);
        const block = core.memoryBlock(pack);
        try { fs.mkdirSync(path.join(cwd, ".codex"), { recursive: true });
          fs.writeFileSync(path.join(cwd, ".codex", "ray-context.md"), block); } catch {} // fallback rung 2
        core.log(AGENT, `recall injected (${pack.text.length} chars)`);
        // VERIFY(M0-7): does 0.147.0 SessionStart honor additionalContext? If not, rung 2 file above is used.
        return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: block } };
      }
      core.writeStatus(AGENT, "recall_skipped_hub_down");
    }
    return {};
  }

  if (mode === "--tool") { // PostToolUse, async:true — observe only
    if (!profile.captureEnabled || scope.capture === false) return {};
    if (core.isSecretPath(JSON.stringify(ev.tool_input ?? {}))) { core.writeStatus(AGENT, "skipped_redaction"); return {}; }
    // VERIFY(M0-4/M0-7): exact event field names (tool_name / tool_input / tool_response)
    const payload = core.redactValue({ tool: ev.tool_name ?? ev.tool, input: ev.tool_input, output: ev.tool_response ?? ev.tool_output });
    const content = JSON.stringify(payload);
    if (core.echoHas(AGENT, core.sha256(content))) return {};
    core.spoolAppend(AGENT, sessionId, { route: "/api/project-memory/codex-event", scope, body: {
      type: String(ev.tool_name ?? "").startsWith("mcp__") ? "mcp-call" : "tool-result", // VERIFY(M0-4) envelope schema
      agentId: AGENT, sessionId, cwd: scope.cwd, bank: scope.bank, project: scope.project,
      timestamp: Date.now(), payload,
      idempotencyKey: core.idempotencyKey(profile, scope.bank, sessionId, String(ev["turn-id"] ?? ""), content),
    } }, profile);
    await core.flushSpool(AGENT, profile, { deadlineMs: 8000, send });
    return {};
  }

  if (mode === "--flush") { await core.flushSpool(AGENT, profile, { deadlineMs: 8000, send }); return {}; }

  // --spool (SessionEnd): DISK ONLY — hard 3s cap, zero network.
  // TODO(M4): if ev carries a transcript path, tail it, redact, spool as an /import envelope.
  core.spoolAppend(AGENT, sessionId, { route: "/api/project-memory/codex-event", scope,
    body: { type: "session-end", agentId: AGENT, sessionId, cwd: scope.cwd, timestamp: Date.now() } }, profile);
  return {};
}

main()
  .catch((e) => { core.log(AGENT, `error ${e?.message}`); return {}; })
  .then((out) => { process.stdout.write(JSON.stringify(out ?? {})); process.exit(0); });
```

`~/.codex/hooks.json` (trust once via `/hooks`; edits change the hash → re-trust):

```json
{ "hooks": {
  "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "statusMessage": "SECOND-BRAIN recall",
    "command": "node C:/Users/kafsh/.config/opencode/plugins/ray-memory/codex-hook.mjs --start", "timeout": 10 }] }],
  "PostToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command",
    "command": "node C:/Users/kafsh/.config/opencode/plugins/ray-memory/codex-hook.mjs --tool", "async": true, "timeout": 30 }] }],
  "Stop": [{ "matcher": "", "hooks": [{ "type": "command",
    "command": "node C:/Users/kafsh/.config/opencode/plugins/ray-memory/codex-hook.mjs --flush", "timeout": 10 }] }],
  "SessionEnd": [{ "matcher": "", "hooks": [{ "type": "command",
    "command": "node C:/Users/kafsh/.config/opencode/plugins/ray-memory/codex-hook.mjs --spool", "timeout": 2 }] }]
} }
```

## 5. `index.js` — OpenCode plugin (V2 + legacy adapter)

```js
// index.js — auto-discovered from ~/.config/opencode/plugins/ray-memory/
// V2 server API when available; legacy V1 fallback. VERIFY(M0-6) decides which path runs.
import * as core from "./core.mjs";

const AGENT = "opencode"; // hub-side principal stays profile.agentId ("atlas", Q3)
const sessions = new Map(); // sessionId -> { scope, injected, capturedUpTo }

export const RayMemory = async (ctx) => {
  const profile = core.loadProfile();
  const client = ctx?.client;
  const directory = ctx?.directory ?? process.cwd();
  const send = core.makeSend(profile, profile.agentId);

  const flush = () => core.flushSpool(AGENT, profile, { deadlineMs: 8000, send }).catch(() => {});
  flush();                                   // crash recovery: replay previous sessions' spool
  const timer = setInterval(flush, 60_000); timer.unref?.();

  const ensure = (sessionId) => {
    if (!sessions.has(sessionId)) sessions.set(sessionId, { scope: core.projectScope(directory), injected: false, capturedUpTo: 0 });
    return sessions.get(sessionId);
  };
  const active = (s) => !profile.killSwitch && profile.captureEnabled && !s.scope.skip && s.scope.capture !== false;

  async function injectOnce(s) {
    if (s.injected || !profile.recallEnabled || profile.killSwitch || s.scope.skip) return null;
    const pack = await core.recallPack(profile, profile.agentId, s.scope, `session start ${s.scope.root ?? s.scope.cwd}`);
    if (!pack) { core.writeStatus(AGENT, "recall_skipped_hub_down"); return null; }
    s.injected = true; core.echoAdd(AGENT, pack.hash);
    return core.memoryBlock(pack);
  }

  function spoolTool(sessionId, tool, input, output) {
    const s = ensure(sessionId); if (!active(s)) return;
    if (core.isSecretPath(JSON.stringify(input ?? {}))) { core.writeStatus(AGENT, "skipped_redaction"); return; }
    const payload = core.redactValue({ tool, input, output });
    const content = JSON.stringify(payload);
    if (core.echoHas(AGENT, core.sha256(content))) return;
    core.spoolAppend(AGENT, sessionId, { route: "/api/project-memory/codex-event", scope: s.scope, // VERIFY(M0-4): accepts agentId "atlas"? else fold into /import messages
      body: { type: String(tool).startsWith("mcp__") ? "mcp-call" : "tool-result", agentId: profile.agentId,
        sessionId, cwd: s.scope.cwd, bank: s.scope.bank, project: s.scope.project, timestamp: Date.now(), payload,
        idempotencyKey: core.idempotencyKey(profile, s.scope.bank, sessionId, String(Date.now()), content) } }, profile);
  }

  const textOf = (m) => (m?.parts ?? []).map((p) => p?.text ?? "").join("\n") || m?.content || ""; // VERIFY(M0-6) message shape

  async function capture(sessionId, msgs) {
    const s = ensure(sessionId); if (!active(s)) return;
    if (!msgs) { try { const r = await client.session.messages({ path: { id: sessionId } }); msgs = r?.data ?? r ?? []; } // VERIFY(M0-6)
      catch (e) { core.log(AGENT, `messages fetch failed: ${e?.message}`); return; } }
    const fresh = msgs.slice(s.capturedUpTo); if (!fresh.length) return;
    const clean = []; let skipped = 0;
    for (const m of fresh) {
      const text = textOf(m);
      if (core.echoHas(AGENT, core.sha256(text))) continue;         // echo guard (DoD #9)
      const r = core.redactText(text); skipped += r.skipped;
      if (r.text.trim()) clean.push({ role: m?.info?.role ?? m?.role ?? "user", content: r.text, timestamp: m?.info?.time?.created ?? Date.now() });
    }
    s.capturedUpTo = msgs.length;
    if (!clean.length) return;
    const content = JSON.stringify(clean);
    core.spoolAppend(AGENT, sessionId, { route: "/api/project-memory/import", scope: s.scope, body: { // VERIFY(M0-4) import schema
      platform: "opencode", conversationId: sessionId, workspacePath: s.scope.cwd,
      bank: s.scope.bank, project: s.scope.project, messages: clean,
      idempotencyKey: core.idempotencyKey(profile, s.scope.bank, sessionId, String(msgs.length), content) } }, profile);
    core.writeStatus(AGENT, skipped ? "captured_with_redaction" : "captured", { skipped });
    await flush();
  }

  // ---------- V2 server API ----------
  if (typeof ctx?.session?.hook === "function" && typeof ctx?.tool?.hook === "function") {
    await ctx.session.hook("context", async (event) => {           // ephemeral system part: never persisted → never re-captured
      try { const s = ensure(event.sessionID); const block = await injectOnce(s);
        if (block) event.system.push({ type: "text", text: block }); } catch (e) { core.log(AGENT, e?.message); }
    });
    await ctx.session.hook("compaction", async (event) => {        // capture before the transcript is compacted away
      try { await capture(event.sessionID, event.messages); } catch (e) { core.log(AGENT, e?.message); }
    });
    await ctx.tool.hook("execute.after", async (event) => {
      try { spoolTool(event.sessionID, event.tool, event.input, event.result); } catch (e) { core.log(AGENT, e?.message); }
    });
    return {};
  }

  // ---------- Legacy V1 fallback ----------
  // Never call client.session.chat() outside session.idle (crash risk); mutate hook outputs instead.
  return {
    "chat.message": async (input, output) => {
      try { const s = ensure(input.sessionID); const block = await injectOnce(s);
        if (block) output.parts.push({ type: "text", text: block, synthetic: true }); } catch (e) { core.log(AGENT, e?.message); }
    },
    "tool.execute.after": async (input, output) => {
      try { spoolTool(input.sessionID, input.tool, input.args, output?.output); } catch (e) { core.log(AGENT, e?.message); }
    },
    event: async ({ event }) => {
      try { if (event.type === "session.idle") await capture(event.properties?.sessionID); } catch (e) { core.log(AGENT, e?.message); }
    },
  };
};
export default RayMemory;
```

---

**How this closes the loop:** every `VERIFY(M0-n)` marker maps to a checklist probe, so M0 isn't paperwork — it produces the exact schemas that finalize these ~10 marked lines. The F2 fix is already encoded in `makeSend` (HTTP 200 with `localStorage-only`/`imported:0` counts as failure → spool keeps it), and the Codex `SessionEnd` path is disk-only inside the 3 s cap.

Run M0 and paste me the probe outputs (M0-4 contracts + M0-6 log + M0-7 result) — I'll finalize the marked lines and then we wire the M2 integration tests (DoD 2/3/7/8) against them.