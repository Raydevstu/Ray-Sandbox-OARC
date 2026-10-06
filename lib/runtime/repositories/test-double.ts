import type { EventRecord, EvidenceRecord, MemoryFactRevision, MemoryScope, OutboxRecord } from '../contracts';
import type { CanonicalRepository, Job, Projection, Snapshot } from './interfaces';

export class TestRepository implements CanonicalRepository {
  private readonly facts: MemoryFactRevision[] = [];
  private readonly events: EventRecord[] = [];
  private readonly projections: Projection[] = [];
  private readonly snapshots: Snapshot[] = [];
  private readonly evidence: EvidenceRecord[] = [];
  private readonly outbox: OutboxRecord[] = [];
  private readonly idempotency = new Map<string, EventRecord>();
  constructor(private readonly tenantId: string) {}
  private check(scope: MemoryScope) { if (scope.tenantId !== this.tenantId || !scope.bankId) throw new Error('scope denied'); }
  async appendEvidence(record: EvidenceRecord) { this.check(record); this.evidence.push({ ...record }); }
  async appendRevision(record: MemoryFactRevision) { this.check(record); this.facts.push({ ...record, evidenceIds: [...record.evidenceIds] }); }
  async findFacts(scope: MemoryScope) { this.check(scope); return this.facts.filter((fact) => fact.tenantId === scope.tenantId && fact.bankId === scope.bankId).map((fact) => ({ ...fact, evidenceIds: [...fact.evidenceIds] })); }
  async appendEvent(record: EventRecord) { this.check(record); this.events.push({ ...record, payload: { ...record.payload } }); this.idempotency.set(record.id, { ...record, payload: { ...record.payload } }); }
  async appendOutbox(record: OutboxRecord) { this.check(record); this.outbox.push({ ...record }); const event = this.events.find((candidate) => candidate.id === record.eventId); if (event) this.idempotency.set(record.idempotencyKey, { ...event, payload: { ...event.payload } }); }
  async claimJobs(scope: MemoryScope, _limit: number): Promise<readonly Job[]> { this.check(scope); return []; }
  async saveProjection(projection: Projection) { this.check(projection); this.projections.push({ ...projection, value: { ...projection.value } }); }
  async getByIdempotencyKey(scope: MemoryScope, key: string) { this.check(scope); return this.idempotency.get(key); }
  async writeSnapshot(snapshot: Snapshot) { this.check(snapshot); this.snapshots.push({ ...snapshot }); }
}
