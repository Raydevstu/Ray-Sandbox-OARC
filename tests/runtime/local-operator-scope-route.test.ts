import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/events/route';
import { parseRuntimeConfig } from '../../lib/runtime/config';
import { createLocalOperatorSession, destroyLocalOperatorSession } from '../../lib/runtime/local-operator';

describe('scoped local operator route reads', () => {
  const config = parseRuntimeConfig({ NODE_ENV: 'test' });
  let cookie = '';

  afterEach(() => { if (cookie) destroyLocalOperatorSession(cookie); cookie = ''; });

  it('rejects bank and project changes even when the tenant remains unchanged', async () => {
    const session = createLocalOperatorSession(config, 'staging');
    cookie = session.cookie;
    const wrongBank = await GET(new Request('http://local/api/project-memory/events?tenantId=staging-tenant&bankId=other-bank&projectId=staging-project', { headers: { cookie } }));
    expect(wrongBank.status).toBe(403);
    const wrongProject = await GET(new Request('http://local/api/project-memory/events?tenantId=staging-tenant&bankId=staging-bank&projectId=other-project', { headers: { cookie } }));
    expect(wrongProject.status).toBe(403);
  });
});
