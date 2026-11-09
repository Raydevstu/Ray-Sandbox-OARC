import type { Pool } from "pg";

type PgPool = Pick<Pool, "query">;

export interface SessionInput {
  sessionId: string;
  tenantId: string;
  bankId: string;
  cwd: string;
  lastActivityAt: string;
  messageCount: number;
}

export interface SessionRow {
  session_id: string;
  bank_id: string;
  cwd: string;
  project_name: string | null;
  last_activity_at: string;
  message_count: number;
}

export function projectNameFromCwd(cwd: string): string {
  if (!cwd) return "";
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? "";
}

export async function upsertSession(pool: PgPool, session: SessionInput): Promise<void> {
  const projectName = projectNameFromCwd(session.cwd);
  await pool.query(
    `INSERT INTO sessions (session_id, tenant_id, bank_id, cwd, project_name, last_activity_at, message_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, session_id) DO UPDATE SET
       bank_id = EXCLUDED.bank_id,
       cwd = EXCLUDED.cwd,
       project_name = EXCLUDED.project_name,
       last_activity_at = EXCLUDED.last_activity_at,
       message_count = EXCLUDED.message_count`,
    [session.sessionId, session.tenantId, session.bankId, session.cwd, projectName || null, session.lastActivityAt, session.messageCount]
  );
}

export async function getLastProject(pool: PgPool, tenantId: string): Promise<SessionRow | null> {
  const result = await pool.query<SessionRow>(
    `SELECT session_id, bank_id, cwd, project_name, last_activity_at, message_count
     FROM sessions
     WHERE tenant_id = $1
     ORDER BY last_activity_at DESC
     LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] ?? null;
}

export async function listRecentProjects(pool: PgPool, tenantId: string, limit = 10): Promise<SessionRow[]> {
  const result = await pool.query<SessionRow>(
    `SELECT DISTINCT ON (cwd) session_id, bank_id, cwd, project_name, last_activity_at, message_count
     FROM sessions
     WHERE tenant_id = $1
     ORDER BY cwd, last_activity_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows;
}

export async function countSessionsByDay(pool: PgPool, tenantId: string): Promise<{ day: string; count: number }[]> {
  const result = await pool.query<{ day: string; count: number }>(
    `SELECT DATE(last_activity_at)::text AS day, COUNT(*)::int AS count
     FROM sessions
     WHERE tenant_id = $1
     GROUP BY DATE(last_activity_at)
     ORDER BY day DESC
     LIMIT 30`,
    [tenantId]
  );
  return result.rows;
}
