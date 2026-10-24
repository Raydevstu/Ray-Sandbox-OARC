CREATE TABLE IF NOT EXISTS prompt_versions (
  prompt_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, project_id, prompt_id, version)
);

CREATE INDEX IF NOT EXISTS prompt_versions_scope_idx
  ON prompt_versions (tenant_id, bank_id, project_id, prompt_id, version DESC);
