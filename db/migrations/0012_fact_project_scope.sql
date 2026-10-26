ALTER TABLE facts ADD COLUMN IF NOT EXISTS project_id TEXT;
CREATE INDEX IF NOT EXISTS facts_project_scope_idx ON facts (tenant_id, bank_id, project_id, revision);
