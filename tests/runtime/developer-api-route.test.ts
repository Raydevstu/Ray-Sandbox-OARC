import { describe, expect, it, beforeEach } from 'vitest';
import { PATCH } from '../../app/api/v1/memory/[id]/route';
import { POST as trace } from '../../app/api/v1/memory/trace/route';
import { POST as replay } from '../../app/api/v1/memory/replay/route';
import { POST as evaluate } from '../../app/api/v1/memory/evaluate/route';
import { POST as retain } from '../../app/api/v1/memory/retain/route';
import { POST as recall } from '../../app/api/v1/memory/recall/route';

const devHeaders = { 'content-type': 'application/json', 'x-dev-subject': 'developer', 'x-dev-tenant-id': 'tenant-1', 'x-dev-scopes': 'memory:read memory:write' };
const request = (url: string, body: unknown, headers = devHeaders) => new Request(`http://localhost${url}`, { method: 'POST', headers, body: JSON.stringify(body) });

describe('developer workflow API routes', () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true';
  });

  it('requires authentication for correction, trace, replay, and evaluation', async () => {
    const body = JSON.stringify({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', query: 'fact' });
    await expect(PATCH(new Request('http://localhost/api/v1/memory/fact-1', { method: 'PATCH', body, headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: 'fact-1' }) })).resolves.toMatchObject({ status: 401 });
    await expect(trace(new Request('http://localhost/api/v1/memory/trace', { method: 'POST', body, headers: { 'content-type': 'application/json' } }))).resolves.toMatchObject({ status: 401 });
    await expect(replay(request('/api/v1/memory/replay', {}))).resolves.toMatchObject({ status: 400 });
    await expect(evaluate(request('/api/v1/memory/evaluate', {}))).resolves.toMatchObject({ status: 400 });
  });

  it('reports unauthorized rather than failed for protected developer routes', async () => {
    const body = JSON.stringify({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', query: 'fact' });
    const correction = await PATCH(new Request('http://localhost/api/v1/memory/fact-1', { method: 'PATCH', body: JSON.stringify({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', claim: 'corrected' }), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: 'fact-1' }) });
    const traced = await trace(new Request('http://localhost/api/v1/memory/trace', { method: 'POST', body, headers: { 'content-type': 'application/json' } }));

    await expect(correction.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
    await expect(traced.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
  });

  it('rejects an unauthenticated retain request with the unauthorized state before repository setup', async () => {
    const response = await retain(new Request('http://localhost/api/v1/memory/retain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', content: 'untrusted write', source: 'test', provenance: 'test', idempotencyKey: 'unauthenticated-retain' }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
  });

  it('rejects an unauthenticated recall request with the unauthorized state before repository setup', async () => {
    const response = await recall(new Request('http://localhost/api/v1/memory/recall', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', query: 'untrusted read' }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
  });

  it('rejects cross-tenant correction before reaching the store', async () => {
    const response = await PATCH(new Request('http://localhost/api/v1/memory/fact-1', { method: 'PATCH', body: JSON.stringify({ tenantId: 'other-tenant', bankId: 'bank-1', projectId: 'project-1', claim: 'corrected' }), headers: devHeaders }), { params: Promise.resolve({ id: 'fact-1' }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'scope denied' });
  });

  it('rejects invalid trace, replay, and evaluation payloads', async () => {
    await expect((await trace(request('/api/v1/memory/trace', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'p1' }))).json()).resolves.toMatchObject({ ok: false, error: 'invalid trace request' });
    await expect((await replay(request('/api/v1/memory/replay', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'p1' }))).json()).resolves.toMatchObject({ ok: false, error: 'invalid replay request' });
    await expect((await evaluate(request('/api/v1/memory/evaluate', { tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'p1' }))).json()).resolves.toMatchObject({ ok: false, error: 'invalid evaluation request' });
  });

  it('accepts a project scope on a correction before checking the canonical store', async () => {
    const response = await PATCH(new Request('http://localhost/api/v1/memory/fact-1', {
      method: 'PATCH',
      headers: devHeaders,
      body: JSON.stringify({ tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', claim: 'scoped correction' }),
    }), { params: Promise.resolve({ id: 'fact-1' }) });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'canonical store is not configured' });
  });
});
