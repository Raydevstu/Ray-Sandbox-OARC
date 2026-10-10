import { describe, expect, it } from 'vitest';
import { createRecallHandler, createRetainHandler } from '../../lib/runtime/api-handlers';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const request = (path: string, body: Record<string, unknown>) => new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('developer API handler states', () => {
  it('reports healthy after retaining durable memory', async () => {
    const response = await createRetainHandler(new TestRepository('tenant-1'))(request('/api/v1/memory/retain', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', content: 'durable fact', source: 'test', provenance: 'test', idempotencyKey: 'state-retain' }));

    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'healthy' });
  });

  it('reports empty when a scoped recall has no durable matches', async () => {
    const response = await createRecallHandler(new TestRepository('tenant-1'))(request('/api/v1/memory/recall', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', query: 'missing' }));

    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'empty' });
  });

  it('classifies invalid and scope-denied shared-handler requests', async () => {
    const repository = new TestRepository('tenant-1');
    const invalid = await createRetainHandler(repository)(request('/api/v1/memory/retain', {}));
    await expect(invalid.json()).resolves.toMatchObject({ ok: false, state: 'failed' });

    const scopeDenied = await createRecallHandler(repository)(request('/api/v1/memory/recall', { tenantId: 'tenant-2', bankId: 'bank-1', query: 'memory' }));
    expect(scopeDenied.status).toBe(403);
    await expect(scopeDenied.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
  });
});
