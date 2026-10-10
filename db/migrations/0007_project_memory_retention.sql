ALTER TABLE project_memory_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS project_memory_retention_idx ON project_memory_records (tenant_id, bank_id, deleted_at);
