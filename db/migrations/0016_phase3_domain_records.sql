CREATE TABLE IF NOT EXISTS phase3_domain_records (
  record_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('learning_episode', 'orchestrator_graph')),
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, project_id, kind, record_id)
);
CREATE INDEX IF NOT EXISTS phase3_domain_records_updated_idx ON phase3_domain_records (tenant_id, bank_id, project_id, kind, updated_at DESC);
