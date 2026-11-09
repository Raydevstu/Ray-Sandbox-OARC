import type { Pool } from "pg";

export interface ClusterRepository {
  createCluster(tenantId: string, bankId: string, cluster: { id: string; entity: string }): Promise<void>;
  getCluster(tenantId: string, bankId: string, clusterId: string): Promise<ReflectionClusterRow | null>;
  updateCluster(tenantId: string, bankId: string, clusterId: string, updates: Partial<ClusterUpdate>): Promise<void>;
  findClustersByEntity(tenantId: string, bankId: string, entity: string): Promise<ReflectionClusterRow[]>;
  addNodeToCluster(tenantId: string, bankId: string, clusterId: string, nodeId: string): Promise<void>;
  listClusters(tenantId: string, bankId: string): Promise<ReflectionClusterRow[]>;
}

export interface ReflectionClusterRow {
  id: string;
  tenantId: string;
  bankId: string;
  entity: string;
  nodeIds: string[];
  insightIds: string[];
  lastReflectedAt: Date | null;
  nextReflectAt: Date | null;
}

interface ClusterUpdate {
  nodeIds: string[];
  insightIds: string[];
  lastReflectedAt: Date;
  nextReflectAt: Date;
}

function rowToCluster(row: any): ReflectionClusterRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    bankId: row.bank_id,
    entity: row.entity,
    nodeIds: row.node_ids ?? [],
    insightIds: row.insight_ids ?? [],
    lastReflectedAt: row.last_reflected_at ? new Date(row.last_reflected_at) : null,
    nextReflectAt: row.next_reflect_at ? new Date(row.next_reflect_at) : null,
  };
}

export function createClusterRepository(pool: Pool): ClusterRepository {
  return {
    async createCluster(tenantId, bankId, cluster) {
      await pool.query(
        `INSERT INTO reflection_clusters (id, tenant_id, bank_id, entity, node_ids, insight_ids)
         VALUES ($1, $2, $3, $4, '{}', '{}')
         ON CONFLICT (tenant_id, bank_id, id) DO NOTHING`,
        [cluster.id, tenantId, bankId, cluster.entity],
      );
    },

    async getCluster(tenantId, bankId, clusterId) {
      const result = await pool.query(
        `SELECT * FROM reflection_clusters WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        [tenantId, bankId, clusterId],
      );
      if (result.rows.length === 0) return null;
      return rowToCluster(result.rows[0]);
    },

    async updateCluster(tenantId, bankId, clusterId, updates) {
      const sets: string[] = [];
      const params: any[] = [tenantId, bankId, clusterId];
      let idx = 4;
      if (updates.nodeIds !== undefined) {
        sets.push(`node_ids = $${idx++}`);
        params.push(updates.nodeIds);
      }
      if (updates.insightIds !== undefined) {
        sets.push(`insight_ids = $${idx++}`);
        params.push(updates.insightIds);
      }
      if (updates.lastReflectedAt !== undefined) {
        sets.push(`last_reflected_at = $${idx++}`);
        params.push(updates.lastReflectedAt);
      }
      if (updates.nextReflectAt !== undefined) {
        sets.push(`next_reflect_at = $${idx++}`);
        params.push(updates.nextReflectAt);
      }
      if (sets.length === 0) return;
      await pool.query(
        `UPDATE reflection_clusters SET ${sets.join(", ")} WHERE tenant_id = $1 AND bank_id = $2 AND id = $3`,
        params,
      );
    },

    async findClustersByEntity(tenantId, bankId, entity) {
      const result = await pool.query(
        `SELECT * FROM reflection_clusters WHERE tenant_id = $1 AND bank_id = $2 AND entity = $3`,
        [tenantId, bankId, entity],
      );
      return result.rows.map(rowToCluster);
    },

    async addNodeToCluster(tenantId, bankId, clusterId, nodeId) {
      await pool.query(
        `UPDATE reflection_clusters
         SET node_ids = array_append(node_ids, $4)
         WHERE tenant_id = $1 AND bank_id = $2 AND id = $3 AND NOT ($4 = ANY(node_ids))`,
        [tenantId, bankId, clusterId, nodeId],
      );
    },

    async listClusters(tenantId, bankId) {
      const result = await pool.query(
        `SELECT * FROM reflection_clusters WHERE tenant_id = $1 AND bank_id = $2 ORDER BY created_at DESC`,
        [tenantId, bankId],
      );
      return result.rows.map(rowToCluster);
    },
  };
}
