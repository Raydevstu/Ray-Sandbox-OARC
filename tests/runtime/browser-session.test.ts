import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/runtime/auth/jwks', () => ({
  authenticateJwt: vi.fn(async () => ({ subject: 'viewer-a', tenantId: 'tenant-a', scopes: new Set(['memory:read']), allowedProjectIds: ['project-a'], source: 'jwt' })),
}));

describe('browser dashboard session', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('creates an HttpOnly session and returns only safe project metadata', async () => {
    const { POST } = await import('../../app/api/auth/session/route');
    const response = await POST(new Request('http://localhost/api/auth/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'signed-token' }) }));

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
  });

  it('clears the session cookie on logout', async () => {
    const { DELETE } = await import('../../app/api/auth/session/route');
    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('creates the local owner session only when development authentication is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APEX_ALLOW_DEV_PRINCIPAL', 'true');
    const { POST } = await import('../../app/api/auth/session/route');
    const response = await POST(new Request('http://localhost/api/auth/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'local-owner' }) }));
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('oarc_dashboard_session=local-owner');
  });

  it('returns safe session metadata without returning the session token', async () => {
    const { GET } = await import('../../app/api/auth/session/route');
    const response = await GET(new Request('http://localhost/api/auth/session', { headers: { cookie: 'oarc_dashboard_session=signed-token' } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ subject: 'viewer-a', tenantId: 'tenant-a', permissions: ['memory:read'], allowedProjectIds: ['project-a'] });
  });
});
