import type { DistilledFact } from "../engine/distillation";
import type { DecisionTrace } from "../engine/decision-trace";
import type { Provenance } from "../engine/memory-lifecycle";

export interface PgPool {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export const DISTILLED_FACTS_DDL = `
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS banks (
    id TEXT NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
  );
  CREATE TABLE IF NOT EXISTS facts (
    id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    entity TEXT NOT NULL DEFAULT 'general',
    category TEXT NOT NULL DEFAULT 'workflow',
    claim TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    importance REAL NOT NULL DEFAULT 50,
    occurrences INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, bank_id, id),
    FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(tenant_id, bank_id, entity);
  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    fact_id TEXT NOT NULL,
    source TEXT NOT NULL,
    content TEXT NOT NULL,
    provenance TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, bank_id, id),
    FOREIGN KEY (tenant_id, bank_id) REFERENCES banks(tenant_id, id)
  );
  CREATE TABLE IF NOT EXISTS deleted_facts (
    tenant_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    fact_id TEXT NOT NULL,
    superseded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, bank_id, fact_id)
  );
`;

export const DECISION_TRACES_DDL = `
  CREATE TABLE IF NOT EXISTS decision_traces (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'sandbox-tenant',
    bank_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]',
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_decision_traces_bank ON decision_traces(tenant_id, bank_id);
`;

export type StoredFact = DistilledFact & { provenance?: Provenance };

export function factIdFor(entity: string, content: string): string {
  return `df-${entity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.abs(hashStr(entity + "|" + content)).toString(36)}`;
}

async function ensureScope(pool: PgPool, tenantId: string, bankId: string): Promise<void> {
  await pool.query(`INSERT INTO tenants (id, created_at) VALUES ($1, NOW()) ON CONFLICT (id) DO NOTHING`, [tenantId]);
  await pool.query(`INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (tenant_id, id) DO NOTHING`, [bankId, tenantId]);
}

export async function saveDistilledFacts(pool: PgPool, tenantId: string, bankId: string, facts: StoredFact[]): Promise<void> {
  await ensureScope(pool, tenantId, bankId);
  for (const f of facts) {
    const id = factIdFor(f.entity, f.content);
    await pool.query(
      `INSERT INTO facts (id, tenant_id, bank_id, revision, entity, category, claim, confidence, importance, occurrences, created_at)
       VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (tenant_id, bank_id, id, revision) DO UPDATE SET claim = EXCLUDED.claim, confidence = EXCLUDED.confidence,
         importance = EXCLUDED.importance, occurrences = EXCLUDED.occurrences, entity = EXCLUDED.entity, category = EXCLUDED.category`,
      [id, tenantId, bankId, f.entity, f.category, f.content, f.confidence, f.importance ?? 50, f.occurrences ?? 1]
    );
    if (f.provenance) {
      const evId = `ev-${id}`;
      await pool.query(
        `INSERT INTO evidence (id, tenant_id, bank_id, source, content, provenance, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET source = EXCLUDED.source, provenance = EXCLUDED.provenance`,
        [evId, tenantId, bankId, f.provenance.source, f.content.slice(0, 500), JSON.stringify(f.provenance)]
      );
      await pool.query(
        `INSERT INTO fact_evidence (tenant_id, bank_id, fact_id, fact_revision, evidence_id)
         VALUES ($1, $2, $3, 1, $4) ON CONFLICT DO NOTHING`,
        [tenantId, bankId, id, evId]
      );
    }
  }
}

export async function loadDistilledFacts(pool: PgPool, tenantId: string, bankId: string, limit = 200): Promise<StoredFact[]> {
  const { rows } = await pool.query(
    `SELECT f.entity, f.category, f.claim AS content, f.confidence, f.importance, f.occurrences,
            (SELECT e.provenance FROM evidence e
             JOIN fact_evidence fe ON fe.tenant_id = e.tenant_id AND fe.bank_id = e.bank_id AND fe.evidence_id = e.id
             WHERE fe.tenant_id = f.tenant_id AND fe.bank_id = f.bank_id AND fe.fact_id = f.id
             ORDER BY e.created_at DESC LIMIT 1) AS provenance
     FROM facts f
     WHERE f.tenant_id = $1 AND f.bank_id = $2
       AND NOT EXISTS (SELECT 1 FROM deleted_facts d WHERE d.tenant_id = f.tenant_id AND d.bank_id = f.bank_id AND d.fact_id = f.id)
     ORDER BY f.importance DESC LIMIT $3`,
    [tenantId, bankId, limit]
  );
  return rows.map((r) => ({
    entity: r.entity ?? "general",
    category: r.category ?? "workflow",
    content: r.content,
    confidence: Number(r.confidence),
    importance: Number(r.importance ?? 50),
    occurrences: Number(r.occurrences ?? 1),
    provenance: r.provenance ? (typeof r.provenance === "string" ? JSON.parse(r.provenance) : r.provenance) : undefined,
  }));
}

export async function markSuperseded(pool: PgPool, tenantId: string, bankId: string, entity: string, supersededBy: string): Promise<void> {
  const { rows } = await pool.query(`SELECT id FROM facts WHERE tenant_id = $1 AND bank_id = $2 AND entity = $3`, [tenantId, bankId, entity]);
  for (const r of rows) {
    await pool.query(
      `INSERT INTO deleted_facts (tenant_id, bank_id, fact_id, superseded_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, bank_id, fact_id) DO UPDATE SET superseded_by = EXCLUDED.superseded_by`,
      [tenantId, bankId, r.id, supersededBy]
    );
  }
}

export async function saveDecisionTrace(pool: PgPool, tenantId: string, bankId: string, trace: DecisionTrace): Promise<void> {
  await pool.query(
    `INSERT INTO decision_traces (id, tenant_id, bank_id, query_hash, task, model, tokens, items, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET outcome = EXCLUDED.outcome`,
    [trace.id, tenantId, bankId, trace.queryHash, trace.task, trace.model, trace.tokens, JSON.stringify(trace.items), trace.outcome ?? null]
  );
}

export async function loadDecisionTraces(pool: PgPool, tenantId: string, bankId: string, limit = 50): Promise<DecisionTrace[]> {
  const { rows } = await pool.query(
    `SELECT id, query_hash, task, model, tokens, items, outcome, created_at
     FROM decision_traces WHERE tenant_id = $1 AND bank_id = $2 ORDER BY created_at DESC LIMIT $3`,
    [tenantId, bankId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    queryHash: r.query_hash,
    task: r.task,
    model: r.model,
    tokens: Number(r.tokens),
    items: typeof r.items === "string" ? JSON.parse(r.items) : (r.items ?? []),
    outcome: r.outcome ?? undefined,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}

export async function traceAcceptance(pool: PgPool, tenantId: string, bankId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE outcome = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE outcome IN ('accepted','edited','reverted')) AS decided
     FROM decision_traces WHERE tenant_id = $1 AND bank_id = $2`,
    [tenantId, bankId]
  );
  const accepted = Number(rows[0]?.accepted ?? 0);
  const decided = Number(rows[0]?.decided ?? 0);
  if (decided === 0) return 0;
  return accepted / decided;
}

export async function setTraceOutcome(
  pool: PgPool,
  tenantId: string,
  bankId: string,
  id: string,
  outcome: "accepted" | "edited" | "reverted"
): Promise<void> {
  if (outcome !== "accepted" && outcome !== "edited" && outcome !== "reverted") {
    throw new Error(`invalid trace outcome: ${String(outcome)}`);
  }
  await pool.query(`UPDATE decision_traces SET outcome = $1 WHERE tenant_id = $2 AND bank_id = $3 AND id = $4`, [outcome, tenantId, bankId, id]);
}

function hashStr(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

const CHAT_SOURCES = ["hermes-push", "hermes-sync"];

const TURN_MATCH = `CASE WHEN e.provenance LIKE '{%' THEN (e.provenance::jsonb->>'turnId') ELSE NULL END = $4`;

/** Remove every chat-ingested fact for one session (resync path). */
export async function deleteChatSessionFacts(
  pool: PgPool,
  tenantId: string,
  bankId: string,
  sessionId: string
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT fe.fact_id AS id FROM fact_evidence fe
     JOIN evidence e ON e.tenant_id = fe.tenant_id AND e.bank_id = fe.bank_id AND e.id = fe.evidence_id
     WHERE fe.tenant_id = $1 AND fe.bank_id = $2
       AND e.source = ANY($3) AND ${TURN_MATCH}`,
    [tenantId, bankId, CHAT_SOURCES, sessionId]
  );
  const ids = rows.map((r) => String(r.id));
  if (ids.length === 0) return 0;
  await pool.query(
    `DELETE FROM fact_evidence WHERE tenant_id = $1 AND bank_id = $2 AND fact_id = ANY($3)`,
    [tenantId, bankId, ids]
  );
  await pool.query(
    `DELETE FROM evidence e WHERE e.tenant_id = $1 AND e.bank_id = $2 AND e.source = ANY($3) AND ${TURN_MATCH} AND e.id LIKE 'ev-%'`,
    [tenantId, bankId, CHAT_SOURCES, sessionId]
  );
  await pool.query(
    `DELETE FROM facts WHERE tenant_id = $1 AND bank_id = $2 AND id = ANY($3)`,
    [tenantId, bankId, ids]
  );
  return ids.length;
}
