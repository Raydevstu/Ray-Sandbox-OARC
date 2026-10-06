import type { EventRecord, MemoryFactRevision, MemoryScope } from '../contracts';
import type { CanonicalRepository, Job, Projection, Snapshot } from './interfaces';

export class TestRepository implements CanonicalRepository {
  private readonly facts: MemoryFactRevision[] = [];
  private readonly events: EventRecord[] = [];
  private readonly projections: Projection[] = [];
  private readonly snapshots: Snapshot[] = [];
  constructor(private readonly tenantId: string) {}
  private check(scope: MemoryScope) { if (scope.tenantId !== this.tenantId || !scope.bankId) throw new Error('scope denied'); }
  async appendRevision(record: MemoryFactRevision) { this.check(record); this.facts.push({ ...record, evidenceIds: [...record.evidenceIds] }); }
  async findFacts(scope: MemoryScope) { this.check(scope); return this.facts.filter((fact) => fact.tenantId === scope.tenantId && fact.bankId === scope.bankId).map((fact) => ({ ...fact, evidenceIds: [...fact.evidenceIds] })); }
  async appendEvent(record: EventRecord) { this.check(record); this.events.push({ ...record, payload: { ...record.payload } }); }
  async claimJobs(scope: MemoryScope, _limit: number): Promise<readonly Job[]> { this.check(scope); return []; }
  async saveProjection(projection: Projection) { this.check(projection); this.projections.push({ ...projection, value: { ...projection.value } }); }
  async getByIdempotencyKey(scope: MemoryScope, key: string) { this.check(scope); return this.events.find((event) => event.tenantId === scope.tenantId && event.bankId === scope.bankId && event.id === key); }
  async writeSnapshot(snapshot: Snapshot) { this.check(snapshot); this.snapshots.push({ ...snapshot }); }
}
