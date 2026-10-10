import { describe, expect, it } from 'vitest';
import { createMemoryApiClient, type ApiEnvelope } from '../../lib/runtime/sdk/client';

describe('developer memory API client', () => {
  it('maps the complete retain-to-evaluate workflow to stable routes', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const transport = {
      request: async (path: string, init: RequestInit): Promise<ApiEnvelope<unknown>> => {
        calls.push({ path, init });
        return { ok: true, requestId: `request-${calls.length}`, data: {} };
      },
    };
    const client = createMemoryApiClient(transport);

    await client.retain({ tenantId: 't1', bankId: 'b1', content: 'fact', source: 'test', provenance: 'test', idempotencyKey: 'k1' });
    await client.recall({ tenantId: 't1', bankId: 'b1', query: 'fact' });
    await client.trace({ tenantId: 't1', bankId: 'b1', projectId: 'p1', query: 'fact' });
    await client.correct('memory-1', { tenantId: 't1', bankId: 'b1', claim: 'corrected fact' });
    await client.replay({ tenantId: 't1', bankId: 'b1', projectId: 'p1', baseline: {}, replay: {}, proposal: {} });
    await client.evaluate({ tenantId: 't1', bankId: 'b1', projectId: 'p1', run: {} });

    expect(calls.map((call) => [call.path, call.init.method])).toEqual([
      ['/api/v1/memory/retain', 'POST'],
      ['/api/v1/memory/recall', 'POST'],
      ['/api/v1/memory/trace', 'POST'],
      ['/api/v1/memory/memory-1', 'PATCH'],
      ['/api/v1/memory/replay', 'POST'],
      ['/api/v1/memory/evaluate', 'POST'],
    ]);
  });
});
