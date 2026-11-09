// Hermes → memory-app chat sync.
// Reads new Hermes chat messages from state.db and POSTs them to the
// memory app's /api/v1/memory/hermes-push endpoint, one call per session
// with only messages newer than the saved cursor. Safe to run on a loop:
// cursors persist in hermes-push-cursor.json next to this script.
//
// Usage:
//   node scripts/hermes-push.mjs [--app http://localhost:3018] [--db "C:/.../state.db"]
//   HERMES_STATE_DB="C:/path/state.db" APP_URL="http://localhost:3018" node scripts/hermes-push.mjs
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CURSOR_FILE = join(HERE, "..", ".data", "hermes-push-cursor.json");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const APP = (arg("app", process.env.APP_URL || "http://localhost:3018")).replace(/\/$/, "");
const DB = arg("db", process.env.HERMES_STATE_DB || "C:/Users/kafsh/AppData/Local/hermes/state.db");
const RESYNC = process.argv.includes("--resync");

function loadCursors() {
  try {
    return JSON.parse(readFileSync(CURSOR_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCursors(c) {
  mkdirSync(dirname(CURSOR_FILE), { recursive: true });
  writeFileSync(CURSOR_FILE, JSON.stringify(c, null, 2));
}

async function main() {
  if (!existsSync(DB)) {
    console.log(`state.db not found at ${DB} — nothing to push`);
    return;
  }
  const cursors = loadCursors();
  const db = new DatabaseSync(DB, { readOnly: true });
  const sessions = db
    .prepare(`SELECT id, COALESCE(cwd,'') AS cwd FROM sessions WHERE cwd IS NOT NULL AND cwd != '' ORDER BY last_activity_at DESC LIMIT 500`)
    .all();
  let pushedSessions = 0;
  let pushedMessages = 0;
  for (const s of sessions) {
    const sid = String(s.id);
    const cursor = RESYNC ? 0 : Number(cursors[sid] ?? 0);
    const order = RESYNC ? "DESC" : "ASC";
    const rows = db
      .prepare(`SELECT role, COALESCE(content,'') AS content, COALESCE(timestamp,0) AS ts
                FROM messages WHERE session_id = ? AND COALESCE(timestamp,0) > ? ORDER BY ts ${order} LIMIT 200`)
      .all(sid, cursor);
    if (RESYNC) rows.reverse();
    const msgs = rows.filter((r) => String(r.content ?? "").trim()).map((r) => ({
      role: String(r.role ?? "user"),
      content: String(r.content).trim().slice(0, 4000),
      timestamp: Number(r.ts ?? 0),
    }));
    if (msgs.length === 0) continue;
    const res = await fetch(`${APP}/api/v1/memory/hermes-push`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-subject": "hermes-sync",
        "x-dev-tenant-id": "sandbox-tenant",
        "x-dev-scopes": "memory:read memory:write",
      },
      body: JSON.stringify({ cwd: String(s.cwd), sessionId: sid, resync: RESYNC, messages: msgs }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.ok) {
      pushedSessions++;
      pushedMessages += msgs.length;
      cursors[sid] = Math.max(...msgs.map((m) => m.timestamp));
      console.log(`pushed ${msgs.length} msgs from ${sid} → bank ${json.data?.bankId ?? "?"}${json.data?.created ? " (new bank)" : ""}`);
    } else {
      console.log(`push failed for ${sid}: ${json?.error ?? res.status}`);
    }
  }
  db.close();
  saveCursors(cursors);
  if (pushedSessions > 0) {
    console.log(`done: ${pushedSessions} sessions, ${pushedMessages} messages`);
  }
}

main().catch((e) => {
  console.error("hermes-push failed:", e.message);
  process.exitCode = 1;
});
