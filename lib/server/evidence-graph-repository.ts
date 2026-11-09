import type { PgPool } from "./pg-lifecycle";
import type { EvidenceLink, EvidenceRelation, MemoryNode } from "../engine/reflective-memory-types";

export interface EvidenceGraphRepository {
  // CRUD
  createLink(link: EvidenceLink, tenantId: string, bankId: string): Promise<void>;
  getLink(tenantId: string, bankId: string, id: string): Promise<EvidenceLink | null>;
  deleteLink(tenantId: string, bankId: string, id: string): Promise<void>;

  // Queries
  listLinksForNode(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]>;
  listOutgoingLinks(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]>;
  listIncomingLinks(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]>;
  getSupportingEvidence(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]>;
  getContradictingEvidence(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]>;

  // Graph traversal
  getEvidenceSubgraph(tenantId: string, bankId: string, nodeId: string, maxDepth: number): Promise<{ nodeIds: string[]; linkIds: string[] }>;

  // Cycle detection
  wouldCreateCycle(tenantId: string, bankId: string, sourceNodeId: string, targetNodeId: string): Promise<boolean>;

  // Orphan detection
  findOrphanInsights(tenantId: string, bankId: string): Promise<string[]>;
}

// Node existence checker — injected to avoid circular dependency
export type NodeExistsFn = (tenantId: string, bankId: string, nodeId: string) => Promise<boolean>;

export function createEvidenceGraphRepository(
  pool: PgPool,
  nodeExists: NodeExistsFn
): EvidenceGraphRepository {
  return {
    async createLink(link: EvidenceLink, tenantId: string, bankId: string): Promise<void> {
      // G1: both endpoints must reference existing MemoryNodes
      const sourceExists = await nodeExists(tenantId, bankId, link.sourceNodeId);
      const targetExists = await nodeExists(tenantId, bankId, link.targetNodeId);
      if (!sourceExists) throw new Error(`source node ${link.sourceNodeId} does not exist`);
      if (!targetExists) throw new Error(`target node ${link.targetNodeId} does not exist`);

      // Cycle prevention for derivedFrom edges
      if (link.relation === "derivedFrom") {
        const cycle = await this.wouldCreateCycle(tenantId, bankId, link.sourceNodeId, link.targetNodeId);
        if (cycle) throw new Error(`creating link would create a cycle`);
      }

      await pool.query(
        `INSERT INTO evidence_links (id, tenant_id, bank_id, source_node_id, target_node_id, relation, weight, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET
           source_node_id = EXCLUDED.source_node_id, target_node_id = EXCLUDED.target_node_id,
           relation = EXCLUDED.relation, weight = EXCLUDED.weight`,
        [link.id, tenantId, bankId, link.sourceNodeId, link.targetNodeId, link.relation, link.weight, link.createdAt]
      );
    },

    async getLink(tenantId: string, bankId: string, id: string): Promise<EvidenceLink | null> {
      const res = await pool.query(
        `SELECT * FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        [tenantId, bankId, id]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id, sourceNodeId: r.source_node_id, targetNodeId: r.target_node_id,
        relation: r.relation, weight: r.weight, createdAt: new Date(r.created_at),
      };
    },

    async deleteLink(tenantId: string, bankId: string, id: string): Promise<void> {
      await pool.query(
        `DELETE FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        [tenantId, bankId, id]
      );
    },

    async listLinksForNode(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]> {
      const res = await pool.query(
        `SELECT * FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND (source_node_id = $3 OR target_node_id = $3)`,
        [tenantId, bankId, nodeId]
      );
      return res.rows.map(rowToLink);
    },

    async listOutgoingLinks(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]> {
      const res = await pool.query(
        `SELECT * FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND source_node_id = $3`,
        [tenantId, bankId, nodeId]
      );
      return res.rows.map(rowToLink);
    },

    async listIncomingLinks(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]> {
      const res = await pool.query(
        `SELECT * FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND target_node_id = $3`,
        [tenantId, bankId, nodeId]
      );
      return res.rows.map(rowToLink);
    },

    async getSupportingEvidence(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]> {
      const res = await pool.query(
        `SELECT * FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND target_node_id = $3 AND relation = 'supports'`,
        [tenantId, bankId, nodeId]
      );
      return res.rows.map(rowToLink);
    },

    async getContradictingEvidence(tenantId: string, bankId: string, nodeId: string): Promise<EvidenceLink[]> {
      const res = await pool.query(
        `SELECT * FROM evidence_links WHERE tenant_id = $1 AND bank_id = $2 AND target_node_id = $3 AND relation = 'contradicts'`,
        [tenantId, bankId, nodeId]
      );
      return res.rows.map(rowToLink);
    },

    async getEvidenceSubgraph(tenantId: string, bankId: string, nodeId: string, maxDepth: number): Promise<{ nodeIds: string[]; linkIds: string[] }> {
      const visitedNodes = new Set<string>([nodeId]);
      const visitedLinks = new Set<string>();
      const queue: { nodeId: string; depth: number }[] = [{ nodeId, depth: 0 }];

      while (queue.length > 0) {
        const { nodeId: current, depth } = queue.shift()!;
        if (depth >= maxDepth) continue;

        const links = await this.listLinksForNode(tenantId, bankId, current);
        for (const link of links) {
          if (!visitedLinks.has(link.id)) {
            visitedLinks.add(link.id);
          }
          const neighbor = link.sourceNodeId === current ? link.targetNodeId : link.sourceNodeId;
          if (!visitedNodes.has(neighbor)) {
            visitedNodes.add(neighbor);
            queue.push({ nodeId: neighbor, depth: depth + 1 });
          }
        }
      }

      return {
        nodeIds: Array.from(visitedNodes),
        linkIds: Array.from(visitedLinks),
      };
    },

    async wouldCreateCycle(tenantId: string, bankId: string, sourceNodeId: string, targetNodeId: string): Promise<boolean> {
      // Check if targetNodeId can already reach sourceNodeId (would create cycle if we add source→target)
      const visited = new Set<string>();
      const queue = [targetNodeId];
      visited.add(targetNodeId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === sourceNodeId) return true;

        const outgoing = await this.listOutgoingLinks(tenantId, bankId, current);
        for (const link of outgoing) {
          if (link.relation === "derivedFrom" && !visited.has(link.targetNodeId)) {
            visited.add(link.targetNodeId);
            queue.push(link.targetNodeId);
          }
        }
      }
      return false;
    },

    async findOrphanInsights(tenantId: string, bankId: string): Promise<string[]> {
      // Active insights with no valid supporting nodes
      const res = await pool.query(
        `SELECT i.id FROM insights i
         WHERE i.tenant_id = $1 AND i.bank_id = $2 AND i.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM evidence_links el
           WHERE el.tenant_id = i.tenant_id AND el.bank_id = i.bank_id
           AND el.target_node_id = i.id AND el.relation = 'supports'
         )`,
        [tenantId, bankId]
      );
      return res.rows.map((r: any) => r.id);
    },
  };
}

function rowToLink(r: any): EvidenceLink {
  return {
    id: r.id,
    sourceNodeId: r.source_node_id,
    targetNodeId: r.target_node_id,
    relation: r.relation,
    weight: r.weight,
    createdAt: new Date(r.created_at),
  };
}
