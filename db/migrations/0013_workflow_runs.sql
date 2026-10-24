CREATE TABLE IF NOT EXISTS workflow_runs (
  workflow_run_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sample', 'real')),
  current_step TEXT NOT NULL,
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'degraded')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_trace_id TEXT,
  last_event_id TEXT,
  PRIMARY KEY (tenant_id, bank_id, workflow_run_id)
);
CREATE INDEX IF NOT EXISTS workflow_runs_project_updated_idx ON workflow_runs (tenant_id, bank_id, project_id, updated_at DESC);
