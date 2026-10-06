import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const fact = { tenantId: 't1', bankId: 'b1', id: 'f1', revision: 1, claim: 'claim', confidence: 1, evidenceIds: ['e1'], createdAt: '2026-10-06T00:00:00.000Z' } as const;
describe('scoped repository ports', () => {
  it('filters reads and rejects cross-tenant writes', async () => {
    const repository = new TestRepository('t1');
    await repository.appendRevision(fact);
    await expect(repository.findFacts({ tenantId: 't1', bankId: 'b1' })).resolves.toHaveLength(1);
    await expect(repository.findFacts({ tenantId: 't2', bankId: 'b1' })).rejects.toThrow();
    await expect(repository.appendRevision({ ...fact, tenantId: 't2' })).rejects.toThrow();
  });
});
