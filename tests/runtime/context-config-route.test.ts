import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../app/api/v1/context/route';

const headers = { 'content-type': 'application/json', 'x-dev-subject': 'context-test', 'x-dev-tenant-id': 'tenant-1', 'x-dev-bank-id': 'bank-1', 'x-dev-project-id': 'project-1', 'x-dev-allowed-project-ids': 'project-1', 'x-dev-scopes': 'memory:read memory:write' };
const valid = { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', configId: 'context-default', version: 1, settings: { budget: 'mid', budgetMode: 'fixed', maxTokens: 4096, rerankerCap: 300, rerankEnabled: true } };

describe('ContextConfig API route', () => {
  beforeEach(() => { process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true'; delete process.env.APEX_DATABASE_URL; });

  it('rejects malformed settings before repository setup', async () => {
    const response = await POST(new Request('http://localhost/api/v1/context', { method: 'POST', headers, body: JSON.stringify({ ...valid, settings: { budget: 'invalid' } }) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'invalid context settings' });
  });

  it('returns unavailable when authenticated context persistence has no PostgreSQL store', async () => {
    const response = await POST(new Request('http://localhost/api/v1/context', { method: 'POST', headers, body: JSON.stringify(valid) }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'canonical store is not configured' });
  });
});
