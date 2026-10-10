CREATE TABLE IF NOT EXISTS project_events (
  id TEXT NOT NULL, tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, project_id TEXT NOT NULL,
  type TEXT NOT NULL, payload JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, sequence INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id), UNIQUE (tenant_id, bank_id, project_id, sequence)
);
CREATE INDEX IF NOT EXISTS project_events_scope_idx ON project_events (tenant_id, bank_id, project_id, sequence);
CREATE TABLE IF NOT EXISTS project_memory_records (
  id TEXT NOT NULL, tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, project_id TEXT NOT NULL,
  record_type TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL,
  confidence REAL NOT NULL, importance TEXT NOT NULL, source JSONB NOT NULL, evidence JSONB NOT NULL,
  supersedes JSONB NOT NULL, related_records JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS project_memory_scope_idx ON project_memory_records (tenant_id, bank_id, project_id, status);
