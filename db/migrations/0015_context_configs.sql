CREATE TABLE IF NOT EXISTS context_configs (
  config_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, project_id, config_id)
);
CREATE INDEX IF NOT EXISTS context_configs_updated_idx ON context_configs (tenant_id, bank_id, project_id, updated_at DESC);
