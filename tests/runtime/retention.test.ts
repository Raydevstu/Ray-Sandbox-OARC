import { describe, expect, it } from 'vitest';
import { retainMemory } from '../../lib/runtime/retention';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

describe('durable retention service', () => {
  it('writes evidence, fact, event, and outbox with provenance', async () => {
    const result = await retainMemory({ tenantId: 't1', bankId: 'b1', content: ' User prefers tea ', source: 'chat', provenance: 'session:s1', idempotencyKey: 'k1' }, new TestRepository('t1'), '2026-10-06T00:00:00.000Z');
    expect(result.fact.evidenceIds).toEqual([result.evidence.id]);
    expect(result.event.type).toBe('MemoryRetained');
    expect(result.replayed).toBe(false);
  });
  it('replays identical idempotency and rejects payload reuse', async () => {
    const repository = new TestRepository('t1');
    const input = { tenantId: 't1', bankId: 'b1', content: 'tea', source: 'chat', provenance: 's1', idempotencyKey: 'k1' };
    await retainMemory(input, repository, '2026-10-06T00:00:00.000Z');
    await expect(retainMemory(input, repository, '2026-10-06T00:00:00.000Z')).resolves.toMatchObject({ replayed: true });
    await expect(retainMemory({ ...input, content: 'coffee' }, repository)).rejects.toThrow('payload conflict');
  });
});
