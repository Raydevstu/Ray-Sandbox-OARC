import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(): Pool | null {
  const url = process.env.APEX_DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000 });
  }
  return pool;
}

export async function ensureSchema() {
  const p = getPgPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS memory_facts (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      text TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT 'world',
      confidence REAL NOT NULL DEFAULT 0.5,
      scopes JSONB NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      entities TEXT[] NOT NULL DEFAULT '{}',
      mentioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_memory_facts_bank ON memory_facts(bank_id);
    CREATE INDEX IF NOT EXISTS idx_memory_facts_scopes ON memory_facts USING GIN (scopes);
  `);
}
