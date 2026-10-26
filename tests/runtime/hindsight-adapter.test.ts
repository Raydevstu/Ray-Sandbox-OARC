import { describe, expect, it, vi } from 'vitest';
import { createHindsightAdapter } from '../../lib/runtime/hindsight-adapter';

describe('Hindsight adapter', () => {
  it('retains timestamped content and recalls normalized result text', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, usage: { total_tokens: 12 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ text: 'Deployment window is Friday at 09:00 UTC.' }] }), { status: 200 }));
    const adapter = createHindsightAdapter({ apiKey: 'test-key', fetchImpl });

    await expect(adapter.retain('benchmark-bank', 'Deployment window is Friday at 09:00 UTC.', '2026-10-23T00:00:00.000Z')).resolves.toEqual({ success: true, usage: { total_tokens: 12 } });
    await expect(adapter.recall('benchmark-bank', 'When is the deployment window?')).resolves.toEqual({ texts: ['Deployment window is Friday at 09:00 UTC.'] });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer test-key' } });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ items: [{ content: 'Deployment window is Friday at 09:00 UTC.', timestamp: '2026-10-23T00:00:00.000Z' }] });
  });

  it('redacts provider response bodies from errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('private provider detail', { status: 401 }));
    const adapter = createHindsightAdapter({ apiKey: 'test-key', fetchImpl });

    await expect(adapter.recall('benchmark-bank', 'query')).rejects.toThrow('Hindsight request failed: 401');
    await expect(adapter.recall('benchmark-bank', 'query')).rejects.not.toThrow('private provider detail');
  });

  it('checks deletion by looking for the exact bank in the bank list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ banks: [{ bank_id: 'other-bank' }] }), { status: 200 }));
    const adapter = createHindsightAdapter({ apiKey: 'test-key', fetchImpl });

    await expect(adapter.bankExists('benchmark-bank')).resolves.toBe(false);
    expect(fetchImpl.mock.calls[0][0]).toContain('/v1/default/banks?q=benchmark-bank');
  });
});
