import { afterEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../app/api/local/operator/session/route';

let cookie = '';

afterEach(() => { cookie = ''; });

describe('local operator session route', () => {
  it('keeps an anonymous browser unauthorized while advertising approved local entry points', async () => {
    const response = await GET(new Request('http://local/api/local/operator/session'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized', data: { availableScopes: [{ id: 'staging' }] } });
  });

  it('sets a server-issued cookie for an approved local scope', async () => {
    const response = await POST(new Request('http://local/api/local/operator/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scopeId: 'staging' }) }));
    expect(response.status).toBe(201);
    cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('oarc_local_operator=');
    expect(cookie).toContain('HttpOnly');
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'healthy', data: { scopeId: 'staging', projectId: 'staging-project' } });
  });

  it('does not allow the browser to choose an arbitrary authority scope', async () => {
    const response = await POST(new Request('http://local/api/local/operator/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scopeId: 'tenant-from-query' }) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'failed' });
  });
});
