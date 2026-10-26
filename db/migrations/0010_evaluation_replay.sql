CREATE TABLE IF NOT EXISTS project_evaluation_runs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  corpus_version TEXT NOT NULL,
  corpus_hash TEXT NOT NULL,
  config_version TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS project_evaluation_runs_lookup_idx ON project_evaluation_runs (tenant_id, bank_id, project_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS project_replay_comparisons (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  baseline_run_id TEXT NOT NULL,
  replay_run_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, baseline_run_id) REFERENCES project_evaluation_runs(tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, replay_run_id) REFERENCES project_evaluation_runs(tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS project_replay_comparisons_lookup_idx ON project_replay_comparisons (tenant_id, bank_id, project_id, created_at DESC);
