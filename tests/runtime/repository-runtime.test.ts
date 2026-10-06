import { describe, expect, it, vi } from 'vitest';
import { isRuntimeStoreConfigured, checkRuntimeStore } from '../../lib/runtime/repository';

describe('runtime repository boundary', () => {
  it('does not treat the deterministic file default as a PostgreSQL runtime', () => {
    vi.stubEnv('APEX_DATABASE_URL', 'file:./apex.db');
    expect(isRuntimeStoreConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('reports an unconfigured store without opening a pool', async () => {
    vi.stubEnv('APEX_DATABASE_URL', '');
    await expect(checkRuntimeStore()).resolves.toBe('not_configured');
    vi.unstubAllEnvs();
  });
});

