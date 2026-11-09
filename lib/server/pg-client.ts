import { Pool } from "pg";
import { DISTILLED_FACTS_DDL, DECISION_TRACES_DDL } from "./pg-lifecycle";

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
  // Ensure lifecycle columns exist on facts before creating indexes that reference them
  await p.query(`
    ALTER TABLE facts ADD COLUMN IF NOT EXISTS entity TEXT NOT NULL DEFAULT 'general';
    ALTER TABLE facts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'workflow';
    ALTER TABLE facts ADD COLUMN IF NOT EXISTS importance REAL NOT NULL DEFAULT 50;
    ALTER TABLE facts ADD COLUMN IF NOT EXISTS occurrences INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE facts ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
  `);
  await p.query(DISTILLED_FACTS_DDL);
  await p.query(DECISION_TRACES_DDL);
}
