import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

describe('typed graph repository', () => {
  it('persists graph entities and temporal evidence-backed edges within scope', async () => {
    const repository = new TestRepository('tenant-1');
    const scope = { tenantId: 'tenant-1', bankId: 'bank-1' };
    await repository.saveGraphEntity(scope, { id: 'a', label: 'Alice', type: 'person' });
    await repository.saveGraphAlias(scope, 'a', 'alice-lower');
    await repository.saveGraphEntity(scope, { id: 'p', label: 'Project', type: 'project' });
    await repository.saveGraphEdge(scope, { id: 'e', from: 'a', to: 'p', type: 'works_on', validFrom: '2026-01-01T00:00:00.000Z', validTo: null, evidenceIds: ['ev-1'] });
    await repository.saveGraphConflict(scope, { key: 'a\u0000p', edgeIds: ['e'], state: 'review', reason: 'contradictory-active-relationships' });
    await expect(repository.listGraph(scope)).resolves.toMatchObject({ entities: [{ id: 'a', aliases: ['alice-lower'] }, { id: 'p' }], edges: [{ id: 'e', evidenceIds: ['ev-1'] }] });
    await expect(repository.listGraphConflicts(scope)).resolves.toEqual([{ key: 'a\u0000p', edgeIds: ['e'], state: 'review', reason: 'contradictory-active-relationships' }]);
  });

  it('rejects graph edges without evidence or with an inverted validity range', async () => {
    const repository = new TestRepository('tenant-1');
    const scope = { tenantId: 'tenant-1', bankId: 'bank-1' };
    await expect(repository.saveGraphEdge(scope, { id: 'missing', from: 'a', to: 'p', type: 'uses', validFrom: '2026-02-01T00:00:00.000Z', validTo: null, evidenceIds: [] })).rejects.toThrow('evidence');
    await expect(repository.saveGraphEdge(scope, { id: 'inverted', from: 'a', to: 'p', type: 'uses', validFrom: '2026-02-02T00:00:00.000Z', validTo: '2026-02-01T00:00:00.000Z', evidenceIds: ['ev-1'] })).rejects.toThrow('validity');
  });
});
