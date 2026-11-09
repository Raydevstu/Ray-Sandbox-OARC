// Backfill sessions table from Hermes state.db
// Usage: APEX_DATABASE_URL=postgresql://... node scripts/backfill-sessions.mjs
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { homedir } from "node:os";
import { join } from "node:path";

const STATE_DB = join(homedir(), ".hermes", "state.db");
const pool = new Pool({ connectionString: process.env.APEX_DATABASE_URL });
const TENANT_ID = "sandbox-tenant";

function projectNameFromCwd(cwd) {
  if (!cwd) return "";
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? "";
}

function bankIdForCwd(cwd) {
  if (!cwd) return "users";
  const base = projectNameFromCwd(cwd) || "users";
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "users";
}

const db = new DatabaseSync(STATE_DB, { readOnly: true });
const sessions = db.prepare(
  `SELECT id, cwd, last_activity_at, message_count FROM sessions WHERE cwd IS NOT NULL AND cwd != '' ORDER BY last_activity_at DESC`
).all();

console.log(`Found ${sessions.length} sessions in state.db`);

let upserted = 0;
for (const s of sessions) {
  const sessionId = String(s.id);
  const cwd = String(s.cwd);
  const bankId = bankIdForCwd(cwd);
  const projectName = projectNameFromCwd(cwd) || null;
  const lastActivityAt = s.last_activity_at
    ? new Date(Number(s.last_activity_at) * 1000).toISOString()
    : new Date().toISOString();

  await pool.query(
    `INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (tenant_id, id) DO NOTHING`,
    [bankId, TENANT_ID]
  );
  await pool.query(
    `INSERT INTO sessions (session_id, tenant_id, bank_id, cwd, project_name, last_activity_at, message_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, session_id) DO UPDATE SET
       bank_id = EXCLUDED.bank_id, cwd = EXCLUDED.cwd, project_name = EXCLUDED.project_name,
       last_activity_at = EXCLUDED.last_activity_at, message_count = EXCLUDED.message_count`,
    [sessionId, TENANT_ID, bankId, cwd, projectName, lastActivityAt, s.message_count ?? 0]
  );
  upserted++;
}

db.close();
await pool.end();
console.log(`Upserted ${upserted} sessions`);
