import type { EventRecord, MemoryFactRevision, MemoryScope } from '../contracts';

export type Job = MemoryScope & Readonly<{ id: string; status: string }>;
export type Projection = MemoryScope & Readonly<{ id: string; value: Readonly<Record<string, unknown>> }>;
export type Snapshot = MemoryScope & Readonly<{ id: string; createdAt: string }>;
export interface CanonicalRepository {
  appendRevision(record: MemoryFactRevision): Promise<void>;
  findFacts(scope: MemoryScope): Promise<readonly MemoryFactRevision[]>;
  appendEvent(record: EventRecord): Promise<void>;
  claimJobs(scope: MemoryScope, limit: number): Promise<readonly Job[]>;
  saveProjection(projection: Projection): Promise<void>;
  getByIdempotencyKey(scope: MemoryScope, key: string): Promise<EventRecord | undefined>;
  writeSnapshot(snapshot: Snapshot): Promise<void>;
}
