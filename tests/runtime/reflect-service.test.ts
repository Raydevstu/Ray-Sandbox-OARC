import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import { retainMemory } from '../../lib/runtime/retention';
import { reflectMemory } from '../../lib/runtime/reflect/service';

describe('runtime reflect service', () => {
  it('persists a reflected answer as a canonical event and outbox record', async () => {
    const repository = new TestRepository('tenant-1');
    const scope = { tenantId: 'tenant-1', bankId: 'bank-1' };
    await retainMemory({ ...scope, content: 'The team prefers Bun for new services.', source: 'test', provenance: 'reflect-test', idempotencyKey: 'retain-1' }, repository);
    const first = await reflectMemory(scope, 'What should the team use?', repository);
    const second = await reflectMemory(scope, 'What should the team use?', repository);
    expect(first.opinions).toHaveLength(1);
    expect(first.response).toContain('Bun');
    expect(second.traceId).toBeTypeOf('string');
  });
});
