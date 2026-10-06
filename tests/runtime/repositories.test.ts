import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import { PostgresRepository } from '../../lib/runtime/repositories/postgres';

const fact = { tenantId: 't1', bankId: 'b1', id: 'f1', revision: 1, claim: 'claim', confidence: 1, evidenceIds: ['e1'], createdAt: '2026-10-06T00:00:00.000Z' } as const;
describe('scoped repository ports', () => {
  it('filters reads and rejects cross-tenant writes', async () => {
    const repository = new TestRepository('t1');
    await repository.appendRevision(fact);
    await expect(repository.findFacts({ tenantId: 't1', bankId: 'b1' })).resolves.toHaveLength(1);
    await expect(repository.findFacts({ tenantId: 't2', bankId: 'b1' })).rejects.toThrow();
    await expect(repository.appendRevision({ ...fact, tenantId: 't2' })).rejects.toThrow();
  });
  it('uses outbox idempotency keys consistently', async () => {
    const repository = new TestRepository('t1');
    await repository.appendEvent({ tenantId: 't1', bankId: 'b1', id: 'event-1', type: 'captured', payload: {}, occurredAt: '2026-10-06T00:00:00.000Z' });
    await expect(repository.getByIdempotencyKey({ tenantId: 't1', bankId: 'b1' }, 'event-1')).resolves.toMatchObject({ id: 'event-1' });
  });
  it('loads evidence ids and writes links in the same scoped transaction', async () => {
    const calls: string[] = [];
    const repository = new PostgresRepository(async (query, params) => {
      calls.push(`${query}|${params.join(',')}`);
      if (query.includes('FROM facts')) return [{ id: 'f1', tenantId: 't1', bankId: 'b1', revision: 1, claim: 'claim', confidence: 1, createdAt: '2026-10-06T00:00:00.000Z', evidenceIds: ['e1'] }];
      return [];
    }, { tenantId: 't1', bankId: 'b1' });
    await repository.appendRevision(fact);
    await expect(repository.findFacts({ tenantId: 't1', bankId: 'b1' })).resolves.toEqual([fact]);
    expect(calls.some((call) => call.includes('fact_evidence'))).toBe(true);
    expect(calls[0]).toContain('BEGIN');
    expect(calls.some((call) => call.includes('COMMIT'))).toBe(true);
    await expect(repository.findFacts({ tenantId: 't2', bankId: 'b1' })).rejects.toThrow('scope');
  });
});
