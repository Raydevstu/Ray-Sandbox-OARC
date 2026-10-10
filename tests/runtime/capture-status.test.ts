import { afterEach, describe, expect, it } from 'vitest';
import { getCaptureStatus, recordCapture, resetCaptureStatus, reconcilePersistedCaptureStatus } from '../../lib/runtime/capture-status';

afterEach(() => resetCaptureStatus());

describe('capture status', () => {
  it('starts explicit and uncaptured', () => expect(getCaptureStatus().state).toBe('uncaptured'));
  it('reports queued and processed lifecycle state', () => {
    recordCapture('received', 'm1');
    recordCapture('normalized', 'm1');
    recordCapture('persisted', 'm1');
    recordCapture('queued', 'm1');
    expect(getCaptureStatus().state).toBe('queued');
    recordCapture('processed', 'm1');
    expect(getCaptureStatus()).toMatchObject({ state: 'processed', processed: 1, lastMessageId: 'm1' });
  });
  it('marks an all-failure stream degraded', () => {
    recordCapture('received', 'm1');
    recordCapture('failed', 'm1');
    expect(getCaptureStatus().state).toBe('degraded');
  });
  it('rehydrates a queued display state from durable event history', () => {
    expect(reconcilePersistedCaptureStatus(getCaptureStatus(), 1)).toMatchObject({
      state: 'queued',
      received: 1,
      normalized: 1,
      persisted: 1,
      queued: 1,
    });
  });
});
