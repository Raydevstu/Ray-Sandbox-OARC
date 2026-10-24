import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

describe('durable prompt versions', () => {
  it('stores and lists prompt versions inside the requested project scope', async () => {
    const repository = new TestRepository('t1');
    await repository.savePromptVersion({
      tenantId: 't1',
      bankId: 'b1',
      projectId: 'p1',
      promptId: 'reflect-default',
      version: 1,
      content: JSON.stringify({ system: 'system', user: 'user' }),
      createdAt: '2026-10-23T00:00:00.000Z',
    });
    await expect(repository.listPromptVersions({ tenantId: 't1', bankId: 'b1' }, 'p1', 'reflect-default', 10)).resolves.toHaveLength(1);
    await expect(repository.listPromptVersions({ tenantId: 't2', bankId: 'b1' }, 'p1', 'reflect-default', 10)).rejects.toThrow('scope denied');
  });
});
