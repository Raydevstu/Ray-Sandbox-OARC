import type { ProjectEvent } from './contracts';

export type ProjectMemoryEnqueuer = Readonly<{ enqueue(event: ProjectEvent): boolean }>;
export type AsyncProjectMemoryEnqueuer = ProjectMemoryEnqueuer & Readonly<{ enqueueAsync(event: ProjectEvent): Promise<boolean>; drainAsync(): Promise<void> }>;

/**
 * Dispatch is deliberately synchronous and bounded: enqueue only records an
 * in-process job. The worker run/flush remains outside the ingestion latency
 * path, and a full queue is reported without failing the source ingestion.
 */
export const dispatchProjectMemory = (dispatcher: ProjectMemoryEnqueuer | undefined, event: ProjectEvent): boolean => {
  if (!dispatcher) return false;
  try { return dispatcher.enqueue(event); } catch { return false; }
};
