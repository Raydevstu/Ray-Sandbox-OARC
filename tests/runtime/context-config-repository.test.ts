import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import type { ContextConfig } from '../../lib/runtime/contracts';

const config: ContextConfig = {
  tenantId: 'tenant-1',
  bankId: 'bank-1',
  projectId: 'project-1',
  configId: 'context-default',
  version: 1,
  settings: { tokenBudget: 4096, retrievalDepth: 8 },
  updatedAt: '2026-10-23T00:00:00.000Z',
};

describe('ContextConfig repository', () => {
  it('persists and reads the latest project-scoped config without leaking another project', async () => {
    const repository = new TestRepository('tenant-1');
    await repository.saveContextConfig(config);

    await expect(repository.getContextConfig({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', config.configId)).resolves.toEqual(config);
    await expect(repository.getContextConfig({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-2', config.configId)).resolves.toBeUndefined();
  });

  it('rejects stale versions and invalid settings', async () => {
    const repository = new TestRepository('tenant-1');
    await repository.saveContextConfig(config);
    await expect(repository.saveContextConfig({ ...config, version: 1, settings: {} })).rejects.toThrow('invalid context config');
    await expect(repository.saveContextConfig({ ...config, version: 0 })).rejects.toThrow('invalid context config');
    await repository.saveContextConfig({ ...config, version: 2 });
    await expect(repository.saveContextConfig({ ...config, version: 1 })).rejects.toThrow('stale context config');
  });
});
