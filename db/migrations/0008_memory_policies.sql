CREATE TABLE IF NOT EXISTS memory_policies (
  policy_id TEXT NOT NULL, tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, project_id TEXT NOT NULL,
  version INTEGER NOT NULL, fingerprint TEXT NOT NULL, policy JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, project_id, policy_id, version)
);
CREATE INDEX IF NOT EXISTS memory_policies_latest_idx ON memory_policies (tenant_id, bank_id, project_id, version DESC);
