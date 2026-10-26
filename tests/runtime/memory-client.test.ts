import { describe, expect, it, vi } from 'vitest';
import { createRuntimeMemoryClient } from '../../lib/runtime/memory-client';

describe('runtime memory client', () => {
  it('sends canonical retain context and preserves the envelope', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, requestId: 'r1', state: 'healthy', data: { fact: { id: 'm1' }, replayed: false } }), { status: 201 }));
    const result = await createRuntimeMemoryClient(fetcher as typeof fetch).retain({ tenantId: 't1', bankId: 'b1', projectId: 'p1', content: 'durable fact', idempotencyKey: 'idem-1' });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/memory/retain', expect.objectContaining({ method: 'POST' }));
    expect(result).toMatchObject({ ok: true, requestId: 'r1', state: 'healthy', data: { replayed: false } });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ tenantId: 't1', bankId: 'b1', projectId: 'p1', source: 'memory-ui' });
  });

  it('returns an explicit unavailable envelope when the server returns one', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, requestId: 'r2', state: 'unavailable', error: 'store unavailable', retryable: true }), { status: 503 }));
    await expect(createRuntimeMemoryClient(fetcher as typeof fetch).recall({ tenantId: 't1', bankId: 'b1', projectId: 'p1', query: 'fact' })).resolves.toMatchObject({ state: 'unavailable', retryable: true });
  });
});
