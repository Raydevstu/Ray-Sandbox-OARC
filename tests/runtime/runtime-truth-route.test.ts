import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../app/api/runtime-truth/route';

describe('runtime truth route', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns non-secret runtime identity with no-store caching', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APEX_DATABASE_URL', 'file:./apex.db');
    vi.stubEnv('GIT_COMMIT_SHA', 'phase-zero-test');

    const response = await GET();

    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual({
      environment: 'test',
      authMode: 'development-principal',
      canonicalStore: 'not_configured',
      buildId: 'phase-zero-test',
      evidence: 'local',
    });
  });
});
