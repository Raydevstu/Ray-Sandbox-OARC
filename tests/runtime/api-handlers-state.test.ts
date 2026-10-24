import { describe, expect, it } from 'vitest';
import { createRecallHandler, createRetainHandler } from '../../lib/runtime/api-handlers';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import { runtimeMetrics } from '../../lib/runtime/live-metrics';
import { projectDashboardMetrics } from '../../lib/runtime/project-dashboard-metrics';

const request = (path: string, body: Record<string, unknown>) => new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('developer API handler states', () => {
  it('reports healthy after retaining durable memory', async () => {
    const before = runtimeMetrics.snapshot().operations.retain;
    const response = await createRetainHandler(new TestRepository('tenant-1'))(request('/api/v1/memory/retain', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', workflowRunId: 'workflow-test', content: 'durable fact', source: 'test', provenance: 'test', idempotencyKey: 'state-retain' }));

    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'healthy' });
    expect(runtimeMetrics.snapshot().operations.retain).toBe(before + 1);
    expect(projectDashboardMetrics.snapshot({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1' }).operations.retain).toBeGreaterThan(0);
  });

  it('reports empty when a scoped recall has no durable matches', async () => {
    const before = runtimeMetrics.snapshot().operations.recall;
    const response = await createRecallHandler(new TestRepository('tenant-1'))(request('/api/v1/memory/recall', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', query: 'missing' }));

    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'empty' });
    expect(runtimeMetrics.snapshot().operations.recall).toBe(before + 1);
  });

  it('supports an explicit summary projection without evidence payloads', async () => {
    const repository = new TestRepository('tenant-1');
    await repository.appendRevision({ tenantId: 'tenant-1', bankId: 'bank-1', id: 'fact-1', revision: 1, claim: 'durable memory', confidence: 0.8, evidenceIds: ['e1'], createdAt: '2026-10-06T00:00:00.000Z' });
    const response = await createRecallHandler(repository)(request('/api/v1/memory/recall', { tenantId: 'tenant-1', bankId: 'bank-1', query: 'durable', projection: 'summary' }));
    const body = await response.json();
    expect(body.data.projection).toBe('summary');
    expect(body.data.facts[0]).toMatchObject({ id: 'fact-1', claim: 'durable memory', confidence: 0.8 });
    expect(body.data.facts[0].evidenceIds).toBeUndefined();
    expect(body.data.packed).toBeUndefined();
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
