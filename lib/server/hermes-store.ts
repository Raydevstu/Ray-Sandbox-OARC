import { DatabaseSync } from "node:sqlite";
import { existsSync } from "fs";
import type { HermesMessage, HermesSession } from "./hermes-sessions";

export const HERMES_DB_ENV = "HERMES_STATE_DB";

export function hermesDbPath(): string | null {
  const p = process.env[HERMES_DB_ENV]?.trim();
  return p && existsSync(p) ? p : null;
}

export function readHermesSessions(dbPath: string): HermesSession[] {
  if (!existsSync(dbPath)) return [];
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT id, COALESCE(cwd,'') AS cwd, COALESCE(last_activity_at,0) AS lastActivity,
                COALESCE(message_count,0) AS messageCount
         FROM sessions WHERE cwd IS NOT NULL AND cwd != '' ORDER BY last_activity_at DESC LIMIT 500`
      )
      .all() as { id: string; cwd: string; lastActivity: number; messageCount: number }[];
    return rows.map((r) => ({
      id: String(r.id),
      cwd: String(r.cwd ?? ""),
      lastActivity: Number(r.lastActivity ?? 0),
      messageCount: Number(r.messageCount ?? 0),
    }));
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

export function readSessionMessages(
  dbPath: string,
  sessionId: string,
  sinceTimestamp: number,
  limit = 200
): HermesMessage[] {
  if (!existsSync(dbPath)) return [];
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = (db
      .prepare(
        `SELECT session_id AS sessionId, role, COALESCE(content,'') AS content,
                COALESCE(timestamp,0) AS timestamp
         FROM messages WHERE session_id = ? AND COALESCE(timestamp,0) > ?
         ORDER BY timestamp ASC LIMIT ?`
      )
      .all(sessionId, sinceTimestamp, limit) as unknown) as HermesMessage[];
    return rows.map((r) => ({
      sessionId: String(r.sessionId),
      role: String(r.role ?? ""),
      content: String(r.content ?? ""),
      timestamp: Number(r.timestamp ?? 0),
    }));
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}
