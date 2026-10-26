import { describe, expect, it, vi } from 'vitest';
import { createZepAdapter } from '../../lib/runtime/zep-adapter';

describe('Zep adapter', () => {
  it('uses the v4 API key header and preserves reference timestamps', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ uuid: 'user-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ uuid: 'thread-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ task: { uuid: 'task-1' } }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ context: 'scoped context' }), { status: 200 }));
    const adapter = createZepAdapter({ apiKey: 'test-key', fetchImpl });

    await adapter.createUser('u1');
    await adapter.createThread('u1');
    const result = await adapter.ingestAndRecall({ userId: 'u1', threadId: 't1', messages: [{ name: 'user', role: 'user', content: 'A fact', referenceTime: '2026-01-01T00:00:00Z' }], returnContext: true });

    expect(result.context).toBe('scoped context');
    expect(fetchImpl.mock.calls[3][1]).toMatchObject({ headers: { Authorization: 'Api-Key test-key' } });
    expect(JSON.parse(String(fetchImpl.mock.calls[3][1]?.body))).toMatchObject({ messages: [{ reference_time: '2026-01-01T00:00:00Z' }] });
  });

  it('redacts provider response bodies from errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('secret provider payload', { status: 401 }));
    const adapter = createZepAdapter({ apiKey: 'test-key', fetchImpl });
    await expect(adapter.createUser('u1')).rejects.toThrow('Zep request failed: 401');
    await expect(adapter.createUser('u1')).rejects.not.toThrow('secret provider payload');
  });

  it('retries a transient safe read once before returning its response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('temporary upstream failure', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ uuid: 'user-1' }), { status: 200 }));
    const adapter = createZepAdapter({ apiKey: 'test-key', fetchImpl, retryDelayMs: 0 });

    await expect(adapter.getUser('user-1')).resolves.toEqual({ uuid: 'user-1' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient safe-read response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    const adapter = createZepAdapter({ apiKey: 'test-key', fetchImpl, safeReadRetries: 3, retryDelayMs: 0 });

    await expect(adapter.getUser('missing-user')).rejects.toThrow('Zep request failed: 404');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts a provider request that exceeds the configured timeout', async () => {
    const fetchImpl = vi.fn((_input: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const adapter = createZepAdapter({ apiKey: 'test-key', fetchImpl, timeoutMs: 10 });

    await expect(adapter.getUser('slow-user')).rejects.toThrow('Zep request timed out after 10ms');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
