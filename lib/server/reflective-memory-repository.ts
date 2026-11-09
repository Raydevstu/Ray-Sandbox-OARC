import type { PgPool } from "./pg-lifecycle";
import type { Fact, Insight, MemoryNode } from "../engine/reflective-memory-types";

export interface ReflectiveMemoryRepository {
  // Fact CRUD
  createFact(fact: Fact): Promise<void>;
  getFact(tenantId: string, bankId: string, id: string): Promise<Fact | null>;
  listFacts(tenantId: string, bankId: string): Promise<Fact[]>;
  updateFact(fact: Fact): Promise<void>;

  // Insight CRUD
  createInsight(insight: Insight): Promise<void>;
  getInsight(tenantId: string, bankId: string, id: string): Promise<Insight | null>;
  listInsights(tenantId: string, bankId: string): Promise<Insight[]>;
  updateInsight(insight: Insight): Promise<void>;

  // Shared
  getNode(tenantId: string, bankId: string, id: string): Promise<MemoryNode | null>;
  listNodes(tenantId: string, bankId: string): Promise<MemoryNode[]>;
}

export function createReflectiveMemoryRepository(pool: PgPool): ReflectiveMemoryRepository {
  return {
    async createFact(fact: Fact): Promise<void> {
      await pool.query(
        `INSERT INTO facts (id, tenant_id, bank_id, revision, entity, category, claim, confidence, importance, occurrences, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET
           entity = EXCLUDED.entity, category = EXCLUDED.category, claim = EXCLUDED.claim,
           confidence = EXCLUDED.confidence, importance = EXCLUDED.importance,
           occurrences = EXCLUDED.occurrences, revision = EXCLUDED.revision`,
        [fact.id, fact.tenantId, fact.bankId, 1, fact.entity, fact.category, fact.claim,
         fact.confidence, fact.importance, fact.occurrences, fact.createdAt]
      );
    },

    async getFact(tenantId: string, bankId: string, id: string): Promise<Fact | null> {
      const res = await pool.query(
        `SELECT * FROM facts WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        [tenantId, bankId, id]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id, kind: "fact", tenantId: r.tenant_id, bankId: r.bank_id,
        entity: r.entity, category: r.category, claim: r.claim,
        confidence: r.confidence, importance: r.importance, occurrences: r.occurrences,
        provenance: { source: "retain" },
        createdAt: new Date(r.created_at), lastValidatedAt: new Date(r.created_at),
      };
    },

    async listFacts(tenantId: string, bankId: string): Promise<Fact[]> {
      const res = await pool.query(
        `SELECT * FROM facts WHERE tenant_id = $1 AND bank_id = $2 ORDER BY created_at DESC`,
        [tenantId, bankId]
      );
      return res.rows.map((r: any) => ({
        id: r.id, kind: "fact" as const, tenantId: r.tenant_id, bankId: r.bank_id,
        entity: r.entity, category: r.category, claim: r.claim,
        confidence: r.confidence, importance: r.importance, occurrences: r.occurrences,
        provenance: { source: "retain" as const },
        createdAt: new Date(r.created_at), lastValidatedAt: new Date(r.created_at),
      }));
    },

    async updateFact(fact: Fact): Promise<void> {
      await this.createFact(fact);
    },

    async createInsight(insight: Insight): Promise<void> {
      await pool.query(
        `INSERT INTO insights (id, tenant_id, bank_id, type, depth, claim, supporting_nodes, contradicting_nodes,
           confidence, stability, predictive_value, parent_insights, status, prediction_count, correct_predictions,
           importance, created_at, last_validated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET
           type = EXCLUDED.type, depth = EXCLUDED.depth, claim = EXCLUDED.claim,
           supporting_nodes = EXCLUDED.supporting_nodes, contradicting_nodes = EXCLUDED.contradicting_nodes,
           confidence = EXCLUDED.confidence, stability = EXCLUDED.stability,
           predictive_value = EXCLUDED.predictive_value, parent_insights = EXCLUDED.parent_insights,
           status = EXCLUDED.status, prediction_count = EXCLUDED.prediction_count,
           correct_predictions = EXCLUDED.correct_predictions, importance = EXCLUDED.importance,
           last_validated_at = EXCLUDED.last_validated_at`,
        [insight.id, insight.tenantId, insight.bankId, insight.type, insight.depth, insight.claim,
         insight.supportingNodes, insight.contradictingNodes, insight.confidence, insight.stability,
         insight.predictiveValue, insight.parentInsights, insight.status, insight.predictionCount,
         insight.correctPredictions, insight.importance, insight.createdAt, insight.lastValidatedAt]
      );
    },

    async getInsight(tenantId: string, bankId: string, id: string): Promise<Insight | null> {
      const res = await pool.query(
        `SELECT * FROM insights WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        [tenantId, bankId, id]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id, kind: "insight", tenantId: r.tenant_id, bankId: r.bank_id,
        type: r.type, depth: r.depth, claim: r.claim,
        supportingNodes: r.supporting_nodes, contradictingNodes: r.contradicting_nodes,
        confidence: r.confidence, stability: r.stability, predictiveValue: r.predictive_value,
        parentInsights: r.parent_insights, status: r.status,
        predictionCount: r.prediction_count, correctPredictions: r.correct_predictions,
        importance: r.importance,
        createdAt: new Date(r.created_at), lastValidatedAt: new Date(r.last_validated_at),
      };
    },

    async listInsights(tenantId: string, bankId: string): Promise<Insight[]> {
      const res = await pool.query(
        `SELECT * FROM insights WHERE tenant_id = $1 AND bank_id = $2 ORDER BY created_at DESC`,
        [tenantId, bankId]
      );
      return res.rows.map((r: any) => ({
        id: r.id, kind: "insight" as const, tenantId: r.tenant_id, bankId: r.bank_id,
        type: r.type, depth: r.depth, claim: r.claim,
        supportingNodes: r.supporting_nodes, contradictingNodes: r.contradicting_nodes,
        confidence: r.confidence, stability: r.stability, predictiveValue: r.predictive_value,
        parentInsights: r.parent_insights, status: r.status,
        predictionCount: r.prediction_count, correctPredictions: r.correct_predictions,
        importance: r.importance,
        createdAt: new Date(r.created_at), lastValidatedAt: new Date(r.last_validated_at),
      }));
    },

    async updateInsight(insight: Insight): Promise<void> {
      await this.createInsight(insight);
    },

    async getNode(tenantId: string, bankId: string, id: string): Promise<MemoryNode | null> {
      const fact = await this.getFact(tenantId, bankId, id);
      if (fact) return fact;
      const insight = await this.getInsight(tenantId, bankId, id);
      return insight;
    },

    async listNodes(tenantId: string, bankId: string): Promise<MemoryNode[]> {
      const facts = await this.listFacts(tenantId, bankId);
      const insights = await this.listInsights(tenantId, bankId);
      return [...facts, ...insights].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}
