import { stableId } from '../contracts';
import type { EventRecord, MemoryScope } from '../contracts';

export type JobRecord = MemoryScope & Readonly<{ id: string; eventId: string; status: 'pending' | 'running' | 'complete' | 'dead-letter'; attempts: number; availableAt: string }>;
export const createJob = (event: EventRecord, now = new Date().toISOString()): JobRecord => ({ tenantId: event.tenantId, bankId: event.bankId, id: stableId('job', event.tenantId, event.bankId, event.id), eventId: event.id, status: 'pending', attempts: 0, availableAt: now });
export const retryJob = (job: JobRecord, maxAttempts: number, now = new Date().toISOString()): JobRecord => ({ ...job, attempts: job.attempts + 1, status: job.attempts + 1 >= maxAttempts ? 'dead-letter' : 'pending', availableAt: now });
