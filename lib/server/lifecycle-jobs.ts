// lib/server/lifecycle-jobs.ts
// Phase 12: Operational lifecycle jobs.

import type { Pool } from "pg";

export interface LifecycleMetrics {
  activeInsights: number;
  archivedInsights: number;
  averageStability: number;
  warningsExpired: number;
  predictionAccuracy: number;
  coldClusters: number;
}

export function createLifecycleJobs(pool: Pool) {
  return {
    async getMetrics(tenantId: string, bankId: string): Promise<LifecycleMetrics> {
      const insightsResult = await pool.query(
        `SELECT status, stability FROM insights WHERE tenant_id = $1 AND bank_id = $2`,
        [tenantId, bankId],
      );
      const active = insightsResult.rows.filter((r: any) => r.status === "active");
      const archived = insightsResult.rows.filter((r: any) => r.status === "archived");
      const avgStability = active.length > 0
        ? active.reduce((sum: number, r: any) => sum + r.stability, 0) / active.length
        : 0;

      const predResult = await pool.query(
        `SELECT outcome FROM predictions WHERE tenant_id = $1 AND bank_id = $2`,
        [tenantId, bankId],
      );
      const evaluated = predResult.rows.filter((r: any) => r.outcome === "correct" || r.outcome === "incorrect");
      const correct = evaluated.filter((r: any) => r.outcome === "correct").length;
      const accuracy = evaluated.length > 0 ? correct / evaluated.length : 0;

      return {
        activeInsights: active.length,
        archivedInsights: archived.length,
        averageStability: Number(avgStability.toFixed(3)),
        warningsExpired: 0,
        predictionAccuracy: Number(accuracy.toFixed(3)),
        coldClusters: 0,
      };
    },
  };
}
