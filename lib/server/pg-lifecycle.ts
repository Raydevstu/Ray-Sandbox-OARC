import type { DistilledFact } from "../engine/distillation";
import type { DecisionTrace } from "../engine/decision-trace";
import type { Provenance } from "../engine/memory-lifecycle";

export interface PgPool {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export const DISTILLED_FACTS_DDL = `
  CREATE TABLE IF NOT EXISTS distilled_facts (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    importance REAL NOT NULL DEFAULT 50,
    occurrences INTEGER NOT NULL DEFAULT 1,
    provenance JSONB NOT NULL DEFAULT '{}',
    superseded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_distilled_facts_bank ON distilled_facts(bank_id);
  CREATE INDEX IF NOT EXISTS idx_distilled_facts_entity ON distilled_facts(entity);
`;

export const DECISION_TRACES_DDL = `
  CREATE TABLE IF NOT EXISTS decision_traces (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]',
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_decision_traces_bank ON decision_traces(bank_id);
`;

export type StoredFact = DistilledFact & { provenance?: Provenance };

export async function saveDistilledFacts(pool: PgPool, bankId: string, facts: StoredFact[]): Promise<void> {
  for (const f of facts) {
    const id = `df-${f.entity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.abs(hashStr(f.content)).toString(36)}`;
    await pool.query(
      `INSERT INTO distilled_facts (id, bank_id, entity, category, content, confidence, importance, occurrences, provenance, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, confidence = EXCLUDED.confidence,
         importance = EXCLUDED.importance, occurrences = EXCLUDED.occurrences,
         provenance = EXCLUDED.provenance, updated_at = NOW()`,
      [id, bankId, f.entity, f.category, f.content, f.confidence, f.importance ?? 50, f.occurrences ?? 1, JSON.stringify(f.provenance ?? {})]
    );
  }
}

export async function loadDistilledFacts(pool: PgPool, bankId: string, limit = 200): Promise<StoredFact[]> {
  const { rows } = await pool.query(
    `SELECT entity, category, content, confidence, importance, occurrences, provenance
     FROM distilled_facts WHERE bank_id = $1 AND superseded_by IS NULL
     ORDER BY importance DESC, updated_at DESC LIMIT $2`,
    [bankId, limit]
  );
  return rows.map((r) => ({
    entity: r.entity,
    category: r.category,
    content: r.content,
    confidence: Number(r.confidence),
    importance: Number(r.importance),
    occurrences: Number(r.occurrences),
    provenance: typeof r.provenance === "string" ? JSON.parse(r.provenance) : (r.provenance ?? {}),
  }));
}

export async function markSuperseded(pool: PgPool, bankId: string, entity: string, supersededBy: string): Promise<void> {
  await pool.query(
    `UPDATE distilled_facts SET superseded_by = $3, updated_at = NOW()
     WHERE bank_id = $1 AND entity = $2 AND superseded_by IS NULL`,
    [bankId, entity, supersededBy]
  );
}

export async function saveDecisionTrace(pool: PgPool, bankId: string, trace: DecisionTrace): Promise<void> {
  await pool.query(
    `INSERT INTO decision_traces (id, bank_id, query_hash, task, model, tokens, items, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET outcome = EXCLUDED.outcome`,
    [trace.id, bankId, trace.queryHash, trace.task, trace.model, trace.tokens, JSON.stringify(trace.items), trace.outcome ?? null]
  );
}

export async function loadDecisionTraces(pool: PgPool, bankId: string, limit = 50): Promise<DecisionTrace[]> {
  const { rows } = await pool.query(
    `SELECT id, query_hash, task, model, tokens, items, outcome, created_at
     FROM decision_traces WHERE bank_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [bankId, limit]
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

export async function traceAcceptance(pool: PgPool, bankId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE outcome = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE outcome IN ('accepted','edited','reverted')) AS decided
     FROM decision_traces WHERE bank_id = $1`,
    [bankId]
  );
  const accepted = Number(rows[0]?.accepted ?? 0);
  const decided = Number(rows[0]?.decided ?? 0);
  if (decided === 0) return 0;
  return accepted / decided;
}

function hashStr(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}
