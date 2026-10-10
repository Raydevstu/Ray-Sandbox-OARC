export type CaptureStage = 'received' | 'normalized' | 'persisted' | 'queued' | 'processed' | 'failed';

export type CaptureStatus = Readonly<{
  state: 'uncaptured' | 'receiving' | 'queued' | 'processed' | 'degraded';
  received: number;
  normalized: number;
  persisted: number;
  queued: number;
  processed: number;
  failed: number;
  lastEventAt: string | null;
  lastMessageId: string | null;
}>;

const counters: Record<CaptureStage, number> = { received: 0, normalized: 0, persisted: 0, queued: 0, processed: 0, failed: 0 };
let lastEventAt: string | null = null;
let lastMessageId: string | null = null;

export function recordCapture(stage: CaptureStage, messageId?: string, at = new Date().toISOString()): void {
  counters[stage] += 1;
  lastEventAt = at;
  if (messageId) lastMessageId = messageId;
}

export function getCaptureStatus(now = Date.now()): CaptureStatus {
  const age = lastEventAt ? now - Date.parse(lastEventAt) : Infinity;
  const state = counters.failed > 0 && counters.failed >= counters.persisted + counters.processed
    ? 'degraded'
    : counters.processed > 0
      ? 'processed'
      : counters.queued > 0 || counters.persisted > 0
        ? 'queued'
        : counters.received > 0
          ? 'receiving'
          : 'uncaptured';
  return { ...counters, state: age > 15 * 60 * 1000 && state !== 'uncaptured' ? 'degraded' : state, lastEventAt, lastMessageId };
}

/**
 * Rehydrates the display status when the durable project-event history is
 * available but this server-rendered request is running in a fresh module
 * instance with empty process-local counters. Durable history proves that an
 * event was persisted; it does not prove that downstream extraction finished,
 * so the conservative state remains queued.
 */
export function reconcilePersistedCaptureStatus(status: CaptureStatus, persistedEvents: number): CaptureStatus {
  if (persistedEvents <= 0 || status.received > 0) return status;
  return {
    ...status,
    received: persistedEvents,
    normalized: persistedEvents,
    persisted: persistedEvents,
    queued: Math.max(status.queued, persistedEvents),
    state: 'queued',
  };
}

export function resetCaptureStatus(): void {
  for (const stage of Object.keys(counters) as CaptureStage[]) counters[stage] = 0;
  lastEventAt = null;
  lastMessageId = null;
}
