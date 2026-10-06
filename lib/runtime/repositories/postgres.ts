import type { MemoryScope, MemoryFactRevision, EventRecord } from '../contracts';
import type { CanonicalRepository, Job, Projection, Snapshot } from './interfaces';

export type SqlExecutor = (query: string, params: readonly unknown[]) => Promise<readonly Record<string, unknown>[]>;
export class PostgresRepository implements CanonicalRepository {
  constructor(private readonly execute: SqlExecutor) {}
  async appendRevision(record: MemoryFactRevision) { await this.execute('INSERT INTO facts (id, tenant_id, bank_id, revision, claim, confidence, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [record.id, record.tenantId, record.bankId, record.revision, record.claim, record.confidence, record.createdAt]); }
  async findFacts(scope: MemoryScope) { const rows = await this.execute('SELECT id, tenant_id AS "tenantId", bank_id AS "bankId", revision, claim, confidence, created_at AS "createdAt" FROM facts WHERE tenant_id = $1 AND bank_id = $2 ORDER BY revision', [scope.tenantId, scope.bankId]); return rows as unknown as readonly MemoryFactRevision[]; }
  async appendEvent(record: EventRecord) { await this.execute('INSERT INTO events (id, tenant_id, bank_id, type, payload, occurred_at) VALUES ($1,$2,$3,$4,$5,$6)', [record.id, record.tenantId, record.bankId, record.type, JSON.stringify(record.payload), record.occurredAt]); }
  async claimJobs(scope: MemoryScope, limit: number) { const rows = await this.execute('SELECT id, tenant_id AS "tenantId", bank_id AS "bankId", status FROM jobs WHERE tenant_id = $1 AND bank_id = $2 AND status = $3 LIMIT $4', [scope.tenantId, scope.bankId, 'pending', limit]); return rows as unknown as readonly Job[]; }
  async saveProjection(projection: Projection) { await this.execute('INSERT INTO retrieval_traces (id, tenant_id, bank_id, query, created_at) VALUES ($1,$2,$3,$4,$5)', [projection.id, projection.tenantId, projection.bankId, JSON.stringify(projection.value), new Date().toISOString()]); }
  async getByIdempotencyKey(scope: MemoryScope, key: string) { const rows = await this.execute('SELECT id, tenant_id AS "tenantId", bank_id AS "bankId", type, payload, occurred_at AS "occurredAt" FROM events e JOIN outbox o ON o.event_id = e.id AND o.tenant_id = e.tenant_id AND o.bank_id = e.bank_id WHERE o.tenant_id = $1 AND o.bank_id = $2 AND o.idempotency_key = $3', [scope.tenantId, scope.bankId, key]); return rows[0] as unknown as EventRecord | undefined; }
  async writeSnapshot(snapshot: Snapshot) { await this.execute('INSERT INTO snapshots (id, tenant_id, bank_id, created_at) VALUES ($1,$2,$3,$4)', [snapshot.id, snapshot.tenantId, snapshot.bankId, snapshot.createdAt]); }
}
