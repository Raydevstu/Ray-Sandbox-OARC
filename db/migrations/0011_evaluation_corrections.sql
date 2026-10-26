CREATE TABLE IF NOT EXISTS project_evaluation_corrections (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, source_run_id) REFERENCES project_evaluation_runs(tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS project_evaluation_corrections_lookup_idx ON project_evaluation_corrections (tenant_id, bank_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_workflow_replays (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  replay_run_id TEXT NOT NULL,
  correction_proposal_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, source_run_id) REFERENCES project_evaluation_runs(tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, replay_run_id) REFERENCES project_evaluation_runs(tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, correction_proposal_id) REFERENCES project_evaluation_corrections(tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS project_workflow_replays_lookup_idx ON project_workflow_replays (tenant_id, bank_id, project_id, created_at DESC);
