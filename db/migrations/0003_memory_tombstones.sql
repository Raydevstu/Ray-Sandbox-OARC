CREATE TABLE IF NOT EXISTS deleted_facts (
  tenant_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, fact_id),
  FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
