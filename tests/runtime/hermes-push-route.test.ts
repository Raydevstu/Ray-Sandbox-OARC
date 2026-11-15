import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    pool: null as unknown,
    saveDistilledFacts: vi.fn(),
    deleteChatSessionFacts: vi.fn(),
    queries: [] as Array<{ text: string; params?: unknown[] }>,
  };
  const fakePool = {
    query: async (text: string, params?: unknown[]) => {
      state.queries.push({ text, params });
      return { rows: [] };
    },
  };
  return {
    state,
    fakePool,
    setPool: (p: unknown) => { state.pool = p; },
    getPool: () => state.pool,
    saveDistilledFacts: state.saveDistilledFacts,
    deleteChatSessionFacts: state.deleteChatSessionFacts,
    queries: state.queries,
  };
});

vi.mock('../../lib/server/pg-client', () => ({
  getPgPool: () => h.getPool(),
  ensureSchema: async () => undefined,
}));

vi.mock('../../lib/server/pg-lifecycle', () => ({
  saveDistilledFacts: (...args: unknown[]) => h.saveDistilledFacts(...args),
  deleteChatSessionFacts: (...args: unknown[]) => h.deleteChatSessionFacts(...args),
}));

vi.mock('../../lib/server/session-repository', () => ({
  upsertSession: vi.fn(async () => undefined),
}));

import { GET, POST } from '../../app/api/v1/memory/hermes-push/route';

const LONG_CONTENT = 'We decided to use PostgreSQL for the second brain store because the previous file based approach did not scale past a single repository. The migration will keep the existing schema and add the lifecycle tables. We will run the backup script nightly and verify the restore path before enabling retention.';

const devHeaders = {
  'content-type': 'application/json',
  'x-dev-subject': 'hermes',
  'x-dev-tenant-id': 'tenant-1',
  'x-dev-bank-id': 'secondosaistudioog',
  'x-dev-project-id': 'project-1',
  'x-dev-scopes': 'memory:read memory:write',
};

const postRequest = (body: unknown) => new Request('http://localhost/api/v1/memory/hermes-push', { method: 'POST', headers: devHeaders, body: JSON.stringify(body) });
const getRequest = () => new Request('http://localhost/api/v1/memory/hermes-push', { method: 'GET', headers: devHeaders });

const pushBody = (overrides: Record<string, unknown> = {}) => ({
  tenantId: 'tenant-1',
  bankId: 'bank-1',
  projectId: 'project-1',
  cwd: 'D:/Projects/Secondosaistudioog',
  sessionId: 'ses_hermes_push_test',
  messages: [{ role: 'user', content: LONG_CONTENT, timestamp: 1 }],
  ...overrides,
});

describe('hermes-push API route', () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true';
    h.setPool(null);
    h.saveDistilledFacts.mockReset();
    h.deleteChatSessionFacts.mockReset();
    h.queries.length = 0;
  });

  afterEach(() => {
    delete process.env.APEX_DATABASE_URL;
  });

  it('returns an explicit no-store degraded state instead of reporting success when the store is absent', async () => {
    const response = await POST(postRequest(pushBody()));
    expect(response.status).toBe(503);
    const json = await response.json();
    await expect(json).toMatchObject({ ok: false, state: 'no-store' });
    expect(h.queries).toHaveLength(0);
    expect(h.saveDistilledFacts).not.toHaveBeenCalled();
  });

  it('reports connected false with a no-store degraded state when the store is absent', async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
    const json = await response.json();
    await expect(json).toMatchObject({ ok: false, state: 'no-store' });
    await expect(json.data).toMatchObject({ connected: false, store: 'no-store' });
  });

  it('persists the pushed transcript as retention-eligible raw evidence and distills separately', async () => {
    h.setPool(h.fakePool);
    const response = await POST(postRequest(pushBody({ sessionId: 'ses_hermes_push_persist' })));
    expect(response.status).toBe(201);
    const json = await response.json();
    await expect(json).toMatchObject({ ok: true, data: { bankId: 'secondosaistudioog', imported: 1 } });

    const saveCall = h.saveDistilledFacts.mock.calls[0];
    expect(saveCall).toBeDefined();
    const facts = saveCall[3] as Array<{ content: string }>;
    expect(JSON.stringify(facts)).not.toContain(LONG_CONTENT);

    const rawInsert = h.queries.find((q) => q.text.includes("VALUES ($1, $2, $3, $4, 'hermes-push'"));
    expect(rawInsert).toBeDefined();
    expect(String(rawInsert?.params?.[4])).toContain('PostgreSQL for the second brain store');
  });

  it('keeps deleting prior session facts on resync', async () => {
    h.setPool(h.fakePool);
    const response = await POST(postRequest(pushBody({ sessionId: 'ses_hermes_push_resync', resync: true })));
    expect(response.status).toBe(201);
    expect(h.deleteChatSessionFacts).toHaveBeenCalledTimes(1);
    expect(h.deleteChatSessionFacts).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'secondosaistudioog', 'ses_hermes_push_resync');
  });
});
