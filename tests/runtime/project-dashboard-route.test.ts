import { afterEach, describe, expect, it, vi } from 'vitest';

const headers = {
  'x-dev-subject': 'dashboard-user',
  'x-dev-tenant-id': 'tenant-a',
  'x-dev-scopes': 'memory:read',
  'x-dev-allowed-project-ids': 'project-a',
};

describe('project dashboard routes', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects an absent or unpermitted project before accessing the store', async () => {
    vi.stubEnv('APEX_ALLOW_DEV_PRINCIPAL', 'true');
    vi.stubEnv('APEX_REQUIRE_JWT', 'false');
    const { GET } = await import('../../app/api/project-dashboard/route');

    const missing = await GET(new Request('http://localhost/api/project-dashboard', { headers }));
    const denied = await GET(new Request('http://localhost/api/project-dashboard?bankId=bank-a&projectId=project-b', { headers }));

    expect(missing.status).toBe(400);
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({ error: 'access denied' });
  });

  it('returns an explicit unavailable state instead of an empty cross-project snapshot', async () => {
    vi.stubEnv('APEX_ALLOW_DEV_PRINCIPAL', 'true');
    vi.stubEnv('APEX_REQUIRE_JWT', 'false');
    vi.stubEnv('APEX_DATABASE_URL', 'file:./apex.db');
    const { GET } = await import('../../app/api/project-dashboard/route');

    const response = await GET(new Request('http://localhost/api/project-dashboard?bankId=bank-a&projectId=project-a', { headers }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ state: 'unavailable', projectId: 'project-a' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
