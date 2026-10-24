import { afterEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../app/api/project-memory/onboarding/route';
import { destroyLocalOperatorSession, createLocalOperatorSession } from '../../lib/runtime/local-operator';
import { parseRuntimeConfig } from '../../lib/runtime/config';

describe('project memory onboarding', () => {
  const config = parseRuntimeConfig({ NODE_ENV: 'test' });
  let cookie = '';

  afterEach(() => { if (cookie) destroyLocalOperatorSession(cookie); cookie = ''; });

  it('automatically returns the authenticated workspace scope', async () => {
    const session = createLocalOperatorSession(config, 'staging');
    cookie = session.cookie;
    const response = await POST(new Request('http://local/api/project-memory/onboarding', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'repo-hash-1', workspaceLabel: 'Three AI Musketeers' }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, state: 'healthy', data: { projectId: 'staging-project', workspaceId: 'repo-hash-1' } });
  });

  it('returns unconfigured when authentication has no project scope', async () => {
    const response = await GET(new Request('http://local/api/project-memory/onboarding', { headers: { 'x-dev-subject': 'user', 'x-dev-tenant-id': 'tenant', 'x-dev-scopes': 'memory:read' } }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'unconfigured' });
  });

  it('rejects unauthenticated onboarding', async () => {
    const response = await GET(new Request('http://local/api/project-memory/onboarding'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
  });
});
