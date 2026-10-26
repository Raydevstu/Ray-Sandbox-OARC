CREATE TABLE IF NOT EXISTS entities (
  id TEXT NOT NULL, tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, label TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id), FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS edges (
  id TEXT NOT NULL, tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL, relation TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, id), FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE edges ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE edges ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS edges_temporal_idx ON edges (tenant_id, bank_id, valid_from, valid_to);
CREATE TABLE IF NOT EXISTS graph_edge_evidence (
  tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, edge_id TEXT NOT NULL, evidence_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, edge_id, evidence_id),
  FOREIGN KEY (tenant_id, bank_id, edge_id) REFERENCES edges(tenant_id, bank_id, id),
  FOREIGN KEY (tenant_id, bank_id, evidence_id) REFERENCES evidence(tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS graph_edge_evidence_lookup_idx ON graph_edge_evidence (tenant_id, bank_id, evidence_id);
CREATE TABLE IF NOT EXISTS entity_aliases (
  tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, entity_id TEXT NOT NULL, alias TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, entity_id, alias),
  FOREIGN KEY (tenant_id, bank_id, entity_id) REFERENCES entities(tenant_id, bank_id, id)
);
CREATE INDEX IF NOT EXISTS entity_aliases_lookup_idx ON entity_aliases (tenant_id, bank_id, alias);
CREATE TABLE IF NOT EXISTS graph_conflicts (
  tenant_id TEXT NOT NULL, bank_id TEXT NOT NULL, conflict_key TEXT NOT NULL,
  edge_ids JSONB NOT NULL, state TEXT NOT NULL, reason TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bank_id, conflict_key)
);
