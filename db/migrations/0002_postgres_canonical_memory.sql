CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS banks (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS facts (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  claim TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id, revision),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  provenance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS fact_evidence (
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  fact_revision INTEGER NOT NULL,
  evidence_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, fact_id, fact_revision, evidence_id),
  FOREIGN KEY (tenant_id, bank_id, fact_id, fact_revision) REFERENCES facts(tenant_id, bank_id, id, revision),
  FOREIGN KEY (tenant_id, bank_id, evidence_id) REFERENCES evidence(tenant_id, bank_id, id)
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'published')),
  PRIMARY KEY (tenant_id, bank_id, id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, bank_id, event_id) REFERENCES events(tenant_id, bank_id, id)
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS retrieval_traces (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  query JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS facts_scope_idx ON facts (tenant_id, bank_id);
CREATE INDEX IF NOT EXISTS evidence_scope_idx ON evidence (tenant_id, bank_id);
CREATE INDEX IF NOT EXISTS events_scope_idx ON events (tenant_id, bank_id);
CREATE INDEX IF NOT EXISTS outbox_scope_idx ON outbox (tenant_id, bank_id);
