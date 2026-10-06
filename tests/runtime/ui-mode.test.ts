import { describe, expect, it, vi } from 'vitest';
import { describeRuntimeMode } from '../../lib/runtime/ui-mode';
import { fetchRuntimeHealth } from '../../lib/runtime/client';

describe('runtime UI mode contracts', () => {
  it('describes deterministic mode without implying live persistence', () => {
    expect(describeRuntimeMode('deterministic')).toEqual({ label: 'Deterministic', description: expect.stringContaining('local seeded browser store') });
  });

  it('normalizes health envelopes', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, requestId: 'req-1', data: { status: 'ok' } }), { status: 200 }));
    await expect(fetchRuntimeHealth(fetcher)).resolves.toMatchObject({ status: 'healthy', requestId: 'req-1' });
  });

  it('reports unreachable runtime without throwing into the UI', async () => {
    await expect(fetchRuntimeHealth(vi.fn(async () => { throw new Error('offline'); }))).resolves.toMatchObject({ status: 'unavailable' });
  });
});
