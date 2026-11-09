// lib/server/prediction-repository.ts
// Phase 11: Prediction persistence.

import type { Pool } from "pg";

export interface PredictionRow {
  id: string;
  tenantId: string;
  bankId: string;
  insightId: string;
  claim: string;
  context: string;
  confidence: number;
  createdAt: Date;
  evaluatedAt: Date | null;
  outcome: "correct" | "incorrect" | "untested" | null;
  actualResult: string | null;
}

export function createPredictionRepository(pool: Pool) {
  return {
    async save(prediction: any, tenantId: string, bankId: string): Promise<void> {
      await pool.query(
        `INSERT INTO predictions (id, tenant_id, bank_id, insight_id, claim, context, confidence, created_at, evaluated_at, outcome, actual_result)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET
           evaluated_at = EXCLUDED.evaluated_at,
           outcome = EXCLUDED.outcome,
           actual_result = EXCLUDED.actual_result`,
        [
          prediction.id, tenantId, bankId, prediction.insightId, prediction.claim,
          prediction.context, prediction.confidence, prediction.createdAt,
          prediction.evaluatedAt, prediction.outcome, prediction.actualResult,
        ],
      );
    },

    async get(tenantId: string, bankId: string, predictionId: string): Promise<PredictionRow | null> {
      const result = await pool.query(
        `SELECT * FROM predictions WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        [tenantId, bankId, predictionId],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        tenantId: row.tenant_id,
        bankId: row.bank_id,
        insightId: row.insight_id,
        claim: row.claim,
        context: row.context,
        confidence: row.confidence,
        createdAt: new Date(row.created_at),
        evaluatedAt: row.evaluated_at ? new Date(row.evaluated_at) : null,
        outcome: row.outcome,
        actualResult: row.actual_result,
      };
    },

    async list(tenantId: string, bankId: string): Promise<PredictionRow[]> {
      const result = await pool.query(
        `SELECT * FROM predictions WHERE tenant_id = $1 AND bank_id = $2 ORDER BY created_at DESC`,
        [tenantId, bankId],
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        bankId: row.bank_id,
        insightId: row.insight_id,
        claim: row.claim,
        context: row.context,
        confidence: row.confidence,
        createdAt: new Date(row.created_at),
        evaluatedAt: row.evaluated_at ? new Date(row.evaluated_at) : null,
        outcome: row.outcome,
        actualResult: row.actual_result,
      }));
    },
  };
}
