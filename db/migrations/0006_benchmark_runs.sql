CREATE TABLE IF NOT EXISTS project_benchmark_runs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  corpus_id TEXT NOT NULL,
  evidence TEXT NOT NULL CHECK (evidence IN ('synthetic', 'live-codex', 'replay')),
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS project_benchmark_runs_lookup_idx ON project_benchmark_runs (tenant_id, bank_id, project_id, generated_at DESC);
