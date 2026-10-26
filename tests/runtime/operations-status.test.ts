import { describe, expect, it } from 'vitest';
import { deriveOperationsStatus } from '../../lib/runtime/operations-status';

describe('operations status', () => {
  it('keeps a historical last error from degrading a healthy queue', () => {
    expect(deriveOperationsStatus({ pending: 0, running: 0, complete: 3, deadLetter: 0, oldestPendingAt: null, lastError: 'old duplicate' })).toEqual({
      status: 'ok',
      activeFailure: false,
      historicalLastError: 'old duplicate',
    });
  });

  it('marks active retries and dead letters as degraded', () => {
    expect(deriveOperationsStatus({ pending: 1, running: 0, complete: 3, deadLetter: 0, oldestPendingAt: '2026-10-10T00:00:00.000Z', lastError: 'retrying' })).toMatchObject({ status: 'degraded', activeFailure: true });
    expect(deriveOperationsStatus({ pending: 0, running: 0, complete: 3, deadLetter: 1, oldestPendingAt: null, lastError: 'terminal' })).toMatchObject({ status: 'degraded', activeFailure: true });
  });
});
