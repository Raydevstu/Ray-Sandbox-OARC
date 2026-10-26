import { stableId } from './contracts';
import type { MemoryScope, ProjectEvent } from './contracts';
import { advanceCheckpoint, type Checkpoint } from './jobs/checkpoints';
import { retryJob, type JobRecord } from './jobs/queue';

export type WorkerTelemetry = Readonly<{ queued: number; processed: number; failed: number; retried: number; deadLettered: number; queueRejected: number; lastLatencyMs: number | null }>;
export type ProjectJob = JobRecord & Readonly<{ projectId: string; event: ProjectEvent }>;
export type ProjectWorkerOptions = Readonly<{ consumer: string; maxQueue: number; concurrency: number; maxAttempts: number; now?: () => string; onProcessed?: (event: ProjectEvent) => void }>;
export type WorkerRunResult = Readonly<{ telemetry: WorkerTelemetry; checkpoint?: Checkpoint; deadLetters: readonly ProjectJob[] }>;

const initialTelemetry = (): WorkerTelemetry => ({ queued: 0, processed: 0, failed: 0, retried: 0, deadLettered: 0, queueRejected: 0, lastLatencyMs: null });
export const createProjectJob = (event: ProjectEvent, now: string): ProjectJob => ({ tenantId: event.tenantId, bankId: event.bankId, id: stableId('project-job', event.tenantId, event.bankId, event.id), eventId: event.id, status: 'pending', attempts: 0, availableAt: now, projectId: event.projectId, event });

export class BoundedProjectWorker {
  private readonly queue: ProjectJob[] = [];
  private readonly deadLetters: ProjectJob[] = [];
  private telemetry = initialTelemetry();
  private checkpoint: Checkpoint | undefined;
  constructor(private readonly scope: MemoryScope, private readonly options: ProjectWorkerOptions, private readonly process: (event: ProjectEvent) => Promise<void>) {}
  enqueue(event: ProjectEvent): boolean { if (event.tenantId !== this.scope.tenantId || event.bankId !== this.scope.bankId) throw new Error('scope denied'); if (this.queue.length >= Math.max(1, this.options.maxQueue)) { this.telemetry = { ...this.telemetry, queueRejected: this.telemetry.queueRejected + 1 }; return false; } this.queue.push(createProjectJob(event, (this.options.now ?? (() => new Date().toISOString()))())); this.telemetry = { ...this.telemetry, queued: this.telemetry.queued + 1 }; return true; }
  async run(): Promise<WorkerRunResult> {
    const workers = Array.from({ length: Math.max(1, Math.min(this.options.concurrency, this.queue.length)) }, async () => {
      while (this.queue.length) {
        const job = this.queue.shift(); if (!job) return;
        const started = Date.now();
        try { await this.process(job.event); this.telemetry = { ...this.telemetry, processed: this.telemetry.processed + 1, lastLatencyMs: Date.now() - started }; this.checkpoint = advanceCheckpoint(this.checkpoint, { tenantId: this.scope.tenantId, bankId: this.scope.bankId, consumer: this.options.consumer, eventId: job.event.id, updatedAt: (this.options.now ?? (() => new Date().toISOString()))() }); }
        catch { const retried = retryJob(job, Math.max(1, this.options.maxAttempts), (this.options.now ?? (() => new Date().toISOString()))()); this.telemetry = { ...this.telemetry, failed: this.telemetry.failed + 1, retried: this.telemetry.retried + (retried.status === 'pending' ? 1 : 0), deadLettered: this.telemetry.deadLettered + (retried.status === 'dead-letter' ? 1 : 0) }; if (retried.status === 'dead-letter') this.deadLetters.push({ ...job, ...retried }); else this.queue.push({ ...job, ...retried }); }
      }
    });
    await Promise.all(workers);
    return { telemetry: this.telemetry, checkpoint: this.checkpoint, deadLetters: [...this.deadLetters] };
  }
}
