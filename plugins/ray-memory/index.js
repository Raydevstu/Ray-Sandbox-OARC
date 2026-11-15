// index.js — Ray Second-Brain OpenCode plugin (auto-discovered from
// ~/.config/opencode/plugins/ray-memory/). Runs on BOTH loaders:
//   - V2 (directory package): default export { id, setup }  (1.18.13 path)
//   - V1 (single .js file):   named export RayMemory(ctx) returning hooks
// The adapter picks the path at runtime (design v2 §8, M0-6).
//
// Rulings: legacy recall injection uses `experimental.chat.system.transform`
// (ephemeral, per model request, never persisted); capture happens on
// session.idle (+ experimental.session.compacting) and tool.execute.after.
// Bodies use the M0-verified hub contracts (docs/contracts/import.json,
// codex-event.json).
import * as core from "./core.mjs";

const AGENT = "opencode";

function makePlugin(ctx) {
  const profile = core.loadProfile();
  const client = ctx?.client;
  const directory = ctx?.directory ?? ctx?.project ?? ctx?.worktree ?? process.cwd();
  const send = core.makeSend(profile, profile.agentId);

  const sessions = new Map();
  const ensure = (sessionId) => {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { scope: core.projectScope(directory), injected: false, capturedUpTo: 0 });
    }
    return sessions.get(sessionId);
  };
  const scopeIds = (s) => ({
    bank: s.scope.bank ?? profile.bankId,
    project: s.scope.project ?? profile.projectId,
  });
  const active = (s) => !profile.killSwitch && profile.captureEnabled !== false && !s.scope.skip;

  const flush = async () => {
    try { return await core.flushSpool(AGENT, profile, { deadlineMs: 8000, send }); }
    catch (e) { core.log(AGENT, `flush failed: ${e?.message}`); return { flushed: 0, failed: 0, deferred: 0 }; }
  };
  // Crash recovery + periodic flush (60 s, unref'd).
  void flush();
  const timer = setInterval(() => { void flush(); }, 60_000);
  timer.unref?.();

  async function injectOnce(s) {
    if (s.injected || profile.recallEnabled === false || profile.killSwitch || s.scope.skip) return null;
    const { bank, project } = scopeIds(s);
    if (!bank || !project) { core.writeStatus(AGENT, "skipped_no_scope", { cwd: s.scope.display ?? directory }); return null; }
    const pack = await core.recallPack(profile, profile.agentId, { bank, project }, `session start ${s.scope.root ?? directory}`);
    if (!pack) { core.writeStatus(AGENT, "recall_skipped_hub_down"); return null; }
    s.injected = true;
    core.echoAdd(AGENT, pack.hash);
    return core.memoryBlock(pack);
  }

  function spoolTool(sessionId, tool, input, output) {
    const s = ensure(sessionId);
    if (!active(s) || !tool) return;
    const { bank, project } = scopeIds(s);
    if (!bank || !project) { core.writeStatus(AGENT, "skipped_no_scope", { cwd: s.scope.display ?? directory }); return; }
    const inputText = JSON.stringify(input ?? {});
    if (core.isSecretPath(inputText)) { core.writeStatus(AGENT, "skipped_redaction", { tool: String(tool) }); return; }
    const payload = core.redactValue({ tool, input, output });
    const content = JSON.stringify(payload);
    const contentHash = core.sha256(content);
    if (core.echoHas(AGENT, contentHash)) return;
    const kind = String(tool).startsWith("mcp__") ? "mcp-call" : "tool-result";
    const body = {
      tenantId: profile.tenantId, bankId: bank, projectId: project,
      conversationId: sessionId,
      messageId: core.idempotencyKey(profile, bank, sessionId, `${tool}:${contentHash.slice(0, 12)}`, content),
      timestamp: new Date().toISOString(), kind, name: String(tool), role: "tool", content,
    };
    core.spoolAppend(AGENT, sessionId, { route: "/api/project-memory/codex-event", body, scope: s.scope }, profile);
    core.writeStatus(AGENT, "captured", { tool: String(tool) });
  }

  const textOf = (m) =>
    (m?.parts ?? []).map((p) => (typeof p === "string" ? p : p?.text ?? "")).join("\n")
    || (typeof m?.content === "string" ? m.content : "");

  async function capture(sessionId, msgs) {
    const s = ensure(sessionId);
    if (!active(s)) return;
    const { bank, project } = scopeIds(s);
    if (!bank || !project) { core.writeStatus(AGENT, "skipped_no_scope", { cwd: s.scope.display ?? directory }); return; }
    if (!msgs) {
      try { const r = await client?.session?.messages?.({ path: { id: sessionId } }); msgs = r?.data ?? r ?? []; }
      catch (e) { core.log(AGENT, `messages fetch failed: ${e?.message}`); return; }
    }
    if (!Array.isArray(msgs)) return;
    const fresh = msgs.slice(s.capturedUpTo);
    if (!fresh.length) return;
    const clean = [];
    let skipped = 0;
    for (const m of fresh) {
      const text = textOf(m);
      if (!text.trim()) continue;
      if (core.echoHas(AGENT, core.sha256(text))) continue;
      const r = core.redactText(text);
      skipped += r.skipped;
      if (r.text.trim()) clean.push({ role: m?.info?.role ?? m?.role ?? "user", content: r.text, timestamp: m?.info?.time?.created ?? Date.now() });
    }
    s.capturedUpTo = msgs.length;
    if (!clean.length) return;
    core.spoolAppend(AGENT, sessionId, {
      route: "/api/project-memory/import",
      body: { tenantId: profile.tenantId, bankId: bank, projectId: project, platform: "opencode",
        conversationId: sessionId, exportedAt: new Date().toISOString(),
        sourceReference: `opencode://session/${sessionId}`, messages: clean },
      scope: s.scope,
    }, profile);
    const result = await flush();
    const drained = (result?.flushed ?? 0) > 0;
    core.writeStatus(AGENT, drained ? (skipped ? "captured_with_redaction" : "captured") : "captured_offline",
      { messages: clean.length, skipped });
  }

  // ---------- V2 registration (directory package path) ----------
  async function registerV2() {
    core.log(AGENT, `v2 setup ctx keys: ${Object.keys(ctx ?? {}).join(",")}`);
    if (typeof ctx?.session?.hook === "function") {
      await ctx.session.hook("context", async (event) => {
        try {
          const sessionId = event?.sessionID ?? event?.id;
          const s = ensure(sessionId);
          const block = await injectOnce(s);
          if (block && Array.isArray(event.system)) event.system.push({ type: "text", text: block });
          // Best-effort capture of fresh messages on each model request.
          try { if (Array.isArray(event.messages) && event.messages.length) await capture(sessionId, event.messages); } catch (e) { core.log(AGENT, e?.message); }
        } catch (e) { core.log(AGENT, e?.message); }
      });
      for (const name of ["compaction", "idle"]) {
        try {
          await ctx.session.hook(name, async (event) => {
            const sessionId = event?.sessionID ?? event?.id;
            if (sessionId) await capture(sessionId, event?.messages);
          });
        } catch (e) { core.log(AGENT, `hook '${name}' unsupported: ${e?.message}`); }
      }
    }
    if (typeof ctx?.tool?.hook === "function") {
      await ctx.tool.hook("execute.after", async (event) => {
        try { spoolTool(event?.sessionID, event?.tool, event?.input, event?.result); } catch (e) { core.log(AGENT, e?.message); }
      });
    }
  }

  // ---------- V1 legacy (single .js file path) ----------
  function legacyHooks() {
    return {
      "experimental.chat.system.transform": async (input, output) => {
        try {
          const sessionId = input?.sessionID ?? input?.id;
          const s = ensure(sessionId);
          const block = await injectOnce(s);
          if (block) output.system.push({ type: "text", text: block });
        } catch (e) { core.log(AGENT, e?.message); }
      },
      "tool.execute.after": async (input, output) => {
        try { spoolTool(input?.sessionID, input?.tool, input?.args, output?.output ?? output); } catch (e) { core.log(AGENT, e?.message); }
      },
      "experimental.session.compacting": async (input, output) => {
        try {
          const sessionId = input?.sessionID ?? input?.id;
          if (sessionId) await capture(sessionId, input?.messages ?? output?.messages);
        } catch (e) { core.log(AGENT, e?.message); }
      },
      event: async ({ event }) => {
        try {
          if (event.type === "session.idle") {
            const sessionId = event.properties?.sessionID ?? event.properties?.info?.id;
            if (sessionId) await capture(sessionId);
          }
        } catch (e) { core.log(AGENT, e?.message); }
      },
    };
  }

  return { profile, registerV2, legacyHooks, flush };
}

// V2 entry (directory package).
export default {
  id: "ray-memory",
  async setup(ctx) {
    const p = makePlugin(ctx);
    await p.registerV2();
  },
};

// V1 entry (single .js file).
export const RayMemory = async (ctx) => {
  const p = makePlugin(ctx);
  return p.legacyHooks();
};
