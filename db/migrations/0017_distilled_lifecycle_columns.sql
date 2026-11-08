-- 0017: distilled lifecycle columns on the canonical schema.
-- Covers everything the lifecycle store needs that predates it on live DBs.
-- Idempotent: safe to run on fresh installs and existing volumes.
ALTER TABLE facts ADD COLUMN IF NOT EXISTS entity TEXT NOT NULL DEFAULT 'general';
ALTER TABLE facts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'workflow';
ALTER TABLE facts ADD COLUMN IF NOT EXISTS importance REAL NOT NULL DEFAULT 50;
ALTER TABLE facts ADD COLUMN IF NOT EXISTS occurrences INTEGER NOT NULL DEFAULT 1;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS fact_id TEXT;
ALTER TABLE deleted_facts ADD COLUMN IF NOT EXISTS superseded_by TEXT;
ALTER TABLE deleted_facts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE decision_traces ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'sandbox-tenant';
CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(tenant_id, bank_id, entity);
CREATE INDEX IF NOT EXISTS idx_decision_traces_bank ON decision_traces(tenant_id, bank_id);
