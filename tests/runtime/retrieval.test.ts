import { describe, expect, it } from 'vitest';
import { recallMemory } from '../../lib/runtime/retrieval';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

describe('runtime lexical retrieval', () => {
  it('retrieves only scoped facts and respects policy and token budget', async () => {
    const repository = new TestRepository('t1');
    await repository.appendRevision({ tenantId: 't1', bankId: 'b1', id: 'f1', revision: 1, claim: 'User prefers tea', confidence: 0.8, evidenceIds: ['e1'], createdAt: '2026-10-06T00:00:00.000Z' });
    await repository.appendRevision({ tenantId: 't1', bankId: 'b1', id: 'f2', revision: 2, claim: 'User prefers coffee', confidence: 0.8, evidenceIds: ['e2'], createdAt: '2026-10-06T00:00:00.000Z' });
    const result = await recallMemory({ tenantId: 't1', bankId: 'b1', query: 'prefers', limit: 10, tokenBudget: 3, policy: 'current' }, repository);
    expect(result.facts).toHaveLength(1);
    expect(result.packed.tokens).toBeLessThanOrEqual(3);
    await expect(recallMemory({ tenantId: 't2', bankId: 'b1', query: 'prefers' }, repository)).rejects.toThrow('scope');
  });
});
