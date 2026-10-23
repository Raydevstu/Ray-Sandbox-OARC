import { describe, expect, it } from 'vitest';
import { classifyOperationalState, type OperationalEnvelope } from '../../lib/runtime/operational-state';

describe('operational state contract', () => {
  it.each([
    [{ ok: true, status: 200, resultCount: 1 }, 'healthy'],
    [{ ok: true, status: 200, resultCount: 0 }, 'empty'],
    [{ ok: true, status: 202 }, 'queued'],
    [{ ok: true, status: 200, degraded: true }, 'degraded'],
    [{ ok: false, status: 503, retryable: true }, 'unavailable'],
    [{ ok: false, status: 422 }, 'failed'],
    [{ ok: false, status: 401 }, 'unauthorized'],
    [{ ok: false, status: 403 }, 'unauthorized'],
  ] as const)('classifies %o as %s', (input, expected) => {
    expect(classifyOperationalState(input)).toBe(expected);
  });

  it('keeps safe request metadata on an operational envelope', () => {
    const response: OperationalEnvelope<{ count: number }> = {
      ok: false,
      requestId: 'req-safe',
      error: 'Canonical store unavailable',
      retryable: true,
      state: 'unavailable',
    };

    expect(response).toMatchObject({
      requestId: 'req-safe',
      error: 'Canonical store unavailable',
      retryable: true,
      state: 'unavailable',
    });
  });
});
