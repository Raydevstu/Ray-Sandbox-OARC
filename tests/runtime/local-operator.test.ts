import { afterEach, describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '../../lib/runtime/config';
import { createLocalOperatorSession, destroyLocalOperatorSession, readLocalOperatorSession } from '../../lib/runtime/local-operator';

const config = parseRuntimeConfig({ NODE_ENV: 'test' });

describe('local operator identity bridge', () => {
  let cookie = '';

  afterEach(() => {
    if (cookie) destroyLocalOperatorSession(cookie);
    cookie = '';
  });

  it('issues a server-owned session for an approved seeded scope', () => {
    const session = createLocalOperatorSession(config, 'staging');
    cookie = session.cookie;
    expect(session.scope).toMatchObject({ tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: 'staging-project' });
    expect(readLocalOperatorSession(config, new Request('http://local', { headers: { cookie: session.cookie } }))).toMatchObject({ subject: 'local-operator', tenantId: session.scope.tenantId, bankId: session.scope.bankId, projectId: session.scope.projectId, scopeId: session.scope.id });
  });

  it('rejects a scope that is not server-approved', () => {
    expect(() => createLocalOperatorSession(config, 'tenant-from-url')).toThrow('unknown local operator scope');
  });

  it('does not accept a forged or production session', () => {
    expect(readLocalOperatorSession(config, new Request('http://local', { headers: { cookie: 'oarc_local_operator=forged' } }))).toBeNull();
    const production = parseRuntimeConfig({ NODE_ENV: 'production', APEX_DATABASE_URL: 'postgres://example', APEX_ALLOW_DEV_PRINCIPAL: 'true' });
    expect(() => createLocalOperatorSession(production, 'staging')).toThrow('disabled');
  });
});
