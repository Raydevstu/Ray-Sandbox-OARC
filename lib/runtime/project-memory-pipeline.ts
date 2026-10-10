import { stableId, type MemoryScope, type ProjectEvent, type ProjectMemoryRecord } from './contracts';
import { extractProjectMemoryCandidates } from './memory-extraction';
import { governCandidates } from './memory-governance';
import type { CanonicalRepository } from './repositories/interfaces';
import type { AsyncProjectMemoryEnqueuer } from './project-memory-dispatch';
import { advanceCheckpoint } from './jobs/checkpoints';
import { BoundedProjectWorker, createProjectJob, type ProjectWorkerOptions, type WorkerRunResult } from './project-worker';

export type ProjectMemoryPipelineOptions = ProjectWorkerOptions;

const nextSequence = (events: readonly ProjectEvent[]): number => Math.max(0, ...events.map((event) => event.sequence)) + 1;
const memoryEvent = (record: ProjectMemoryRecord, sequence: number, kind: 'recorded' | 'status'): ProjectEvent => ({
  tenantId: record.tenantId, bankId: record.bankId, projectId: record.projectId,
  id: stableId('project-memory-event', kind, record.id, record.updatedAt, record.status, String(sequence)),
  type: kind === 'recorded' ? 'ProjectMemoryRecorded' : 'ProjectMemoryStatusChanged',
  payload: kind === 'recorded' ? { record } : { recordId: record.id, status: record.status },
  occurredAt: record.updatedAt, sequence,
});

export class ProjectMemoryPipeline {
  private readonly worker: BoundedProjectWorker;
  constructor(private readonly repository: CanonicalRepository, private readonly scope: MemoryScope, options: ProjectMemoryPipelineOptions) {
    this.worker = new BoundedProjectWorker(scope, options, (event) => this.process(event));
  }
  enqueue(event: ProjectEvent): boolean { return this.worker.enqueue(event); }
  async run(): Promise<WorkerRunResult> { return this.worker.run(); }
  async process(event: ProjectEvent): Promise<void> {
    const events = await this.repository.listProjectEvents(this.scope, event.projectId);
    const existing = await this.repository.listProjectMemory(this.scope, event.projectId);
    // Projection events are outputs, not new source evidence. Replaying them as
    // extraction input would recursively manufacture duplicate memories.
    const sourceEvents = events.filter((candidate) => !candidate.type.startsWith('ProjectMemory'));
    const governed = governCandidates(existing, extractProjectMemoryCandidates(sourceEvents));
    let sequence = nextSequence(events);
    for (const action of governed.actions) {
      const record = governed.records.find((candidate) => candidate.id === action.recordId);
      if (!record) continue;
      await this.repository.upsertProjectMemory(record);
      if (action.kind === 'created') await this.repository.appendProjectEvent(memoryEvent(record, sequence++, 'recorded'));
      else if (action.kind === 'superseded' || action.kind === 'conflict' || action.kind === 'invalidated') await this.repository.appendProjectEvent(memoryEvent(record, sequence++, 'status'));
    }
  }
}

/** PostgreSQL-backed worker. Jobs are claimed with SKIP LOCKED and leases, so a
 * new process can recover work left running by a crashed process. */
class PersistentProjectMemoryWorker {
  private readonly accepted = new Set<string>();
  private telemetry = { queued: 0, processed: 0, failed: 0, retried: 0, deadLettered: 0, queueRejected: 0, lastLatencyMs: null as number | null };
  constructor(private readonly repository: CanonicalRepository, private readonly scope: MemoryScope, private readonly options: ProjectMemoryPipelineOptions, private readonly process: (event: ProjectEvent) => Promise<void>) {}
  enqueue(event: ProjectEvent): boolean {
    if (event.tenantId !== this.scope.tenantId || event.bankId !== this.scope.bankId) throw new Error('scope denied');
    const id = stableId('project-job', event.tenantId, event.bankId, event.id);
    if (this.accepted.size >= Math.max(1, this.options.maxQueue)) { this.telemetry = { ...this.telemetry, queueRejected: this.telemetry.queueRejected + 1 }; return false; }
    this.accepted.add(id); this.telemetry = { ...this.telemetry, queued: this.telemetry.queued + 1 };
    return true;
  }
  async run(): Promise<WorkerRunResult> {
    const jobs = await this.repository.claimProjectJobs(this.scope, this.options.consumer, Math.max(1, this.options.concurrency), 30_000);
    const results = await Promise.all(jobs.map(async (job) => {
      const started = Date.now();
      try {
        await this.process(job.event);
        await this.repository.completeProjectJob(this.scope, job.id, this.options.consumer);
        const checkpoint = advanceCheckpoint(await this.repository.getProjectCheckpoint(this.scope, this.options.consumer), { ...this.scope, consumer: this.options.consumer, eventId: job.event.id, updatedAt: (this.options.now ?? (() => new Date().toISOString()))() });
        await this.repository.saveProjectCheckpoint(checkpoint);
        this.accepted.delete(job.id); this.telemetry = { ...this.telemetry, processed: this.telemetry.processed + 1, lastLatencyMs: Date.now() - started };
        this.options.onProcessed?.(job.event);
        return undefined;
      } catch (error) {
        const retryAt = new Date(Date.now() + Math.min(30_000, 250 * (2 ** Math.max(0, job.attempts - 1)))).toISOString();
        const status = await this.repository.failProjectJob(this.scope, job.id, this.options.consumer, error instanceof Error ? error.message : String(error), this.options.maxAttempts, retryAt);
        if (status === 'dead-letter') this.accepted.delete(job.id);
        this.telemetry = { ...this.telemetry, failed: this.telemetry.failed + 1, retried: this.telemetry.retried + (status === 'pending' ? 1 : 0), deadLettered: this.telemetry.deadLettered + (status === 'dead-letter' ? 1 : 0) };
        return status === 'dead-letter' ? job : undefined;
      }
    }));
    return { telemetry: this.telemetry, checkpoint: await this.repository.getProjectCheckpoint(this.scope, this.options.consumer), deadLetters: results.filter((job): job is NonNullable<typeof job> => Boolean(job)) };
  }
}

export const createAsyncProjectMemoryDispatcher = (repository: CanonicalRepository, scope: MemoryScope, options: ProjectMemoryPipelineOptions): AsyncProjectMemoryEnqueuer => {
  const pipeline = new ProjectMemoryPipeline(repository, scope, options);
  const durable = new PersistentProjectMemoryWorker(repository, scope, options, (event) => pipeline.process(event));
  let running = false;
  const drain = async () => { if (running) return; running = true; try { await durable.run(); } finally { running = false; } };
  const enqueueAsync = async (event: ProjectEvent): Promise<boolean> => {
    if (event.tenantId !== scope.tenantId || event.bankId !== scope.bankId) throw new Error('scope denied');
    const accepted = durable.enqueue(event);
    if (!accepted) return false;
    await new Promise<void>((resolve, reject) => {
      void repository.enqueueProjectJob(createProjectJob(event, (options.now ?? (() => new Date().toISOString()))()))
        .then(() => resolve(), reject);
    });
    await drain();
    return true;
  };
  return { enqueue: (event) => { void enqueueAsync(event).catch(() => undefined); return true; }, enqueueAsync, drainAsync: drain };
};
