import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    importConversationExport: vi.fn(),
  };
  return {
    state,
    importConversationExport: state.importConversationExport,
  };
});

vi.mock('../../lib/runtime/repository', () => ({
  createRuntimeRepository: vi.fn(() => ({
    listProjectEvents: vi.fn(async () => []),
    appendProjectEventNextSequence: vi.fn(async (event: unknown) => event),
  })),
  isRuntimeStoreConfigured: vi.fn(() => false),
}));
vi.mock('../../lib/runtime/project-memory-pipeline', () => ({
  createAsyncProjectMemoryDispatcher: vi.fn(() => ({ enqueueAsync: vi.fn(async () => true) })),
}));
vi.mock('../../lib/runtime/cross-platform-import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/runtime/cross-platform-import')>();
  return {
    ...actual,
    importConversationExport: (...args: unknown[]) => h.importConversationExport(...args),
  };
});

import { POST as sessionRegisterPOST } from '../../app/api/project-memory/session-register/route';
import { POST as importPOST } from '../../app/api/project-memory/import/route';
import { registerSession, resolveSessionScope, clearSessionRegistry } from '../../lib/server/session-register';

const devHeaders = (tenant = 'tenant-1') => ({
  'content-type': 'application/json',
  'x-dev-subject': 'agent',
  'x-dev-tenant-id': tenant,
  'x-dev-bank-id': 'bank-1',
  'x-dev-project-id': 'project-1',
  'x-dev-scopes': 'memory:read memory:write events:write',
});

describe('session-register (Task 10)', () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true';
    clearSessionRegistry();
    h.importConversationExport.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearSessionRegistry();
    vi.useRealTimers();
  });

  it('registers and resolves a session scope', async () => {
    const response = await sessionRegisterPOST(new Request('http://localhost/api/project-memory/session-register', {
      method: 'POST',
      headers: devHeaders('tenant-1'),
      body: JSON.stringify({ sessionId: 'ses-1', cwd: 'D:/Projects/Secondosaistudioog', bank: 'bank-a', project: 'project-a' }),
    }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({ sessionId: 'ses-1', tenantId: 'tenant-1', bankId: 'bank-a', projectId: 'project-a' });

    expect(resolveSessionScope('tenant-1', 'ses-1')).toMatchObject({ tenantId: 'tenant-1', bankId: 'bank-a', projectId: 'project-a' });
  });

  it('returns null for an unknown session', () => {
    expect(resolveSessionScope('tenant-1', 'missing')).toBeNull();
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'));
    registerSession({ tenantId: 'tenant-1', sessionId: 'ses-ttl', bankId: 'bank-a', projectId: 'project-a' }, 1000);
    expect(resolveSessionScope('tenant-1', 'ses-ttl')).not.toBeNull();
    vi.setSystemTime(new Date('2026-11-15T00:00:02.000Z'));
    expect(resolveSessionScope('tenant-1', 'ses-ttl')).toBeNull();
  });

  it('scopes registry entries by tenant', () => {
    registerSession({ tenantId: 'tenant-1', sessionId: 'ses-shared', bankId: 'bank-a', projectId: 'project-a' });
    registerSession({ tenantId: 'tenant-2', sessionId: 'ses-shared', bankId: 'bank-b', projectId: 'project-b' });
    expect(resolveSessionScope('tenant-1', 'ses-shared')).toMatchObject({ tenantId: 'tenant-1', bankId: 'bank-a' });
    expect(resolveSessionScope('tenant-2', 'ses-shared')).toMatchObject({ tenantId: 'tenant-2', bankId: 'bank-b' });
    expect(resolveSessionScope('tenant-3', 'ses-shared')).toBeNull();
  });

  it('accepts platform "browser" and rejects "bogus" in import schema', async () => {
    const base = {
      tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1',
      conversationId: 'conv-1', exportedAt: '2026-11-15T00:00:00.000Z', sourceReference: 'ref-1',
      messages: [{ role: 'user', content: 'hello' }],
    };

    const ok = await importPOST(new Request('http://localhost/api/project-memory/import', {
      method: 'POST', headers: devHeaders('tenant-1'), body: JSON.stringify({ ...base, platform: 'browser' }),
    }));
    // store is mocked unconfigured -> 503, but schema must accept "browser" (not 400 invalid import payload)
    expect(ok.status).toBe(503);
    await expect(ok.json()).resolves.toMatchObject({ ok: false, error: 'canonical store is not configured' });

    const bad = await importPOST(new Request('http://localhost/api/project-memory/import', {
      method: 'POST', headers: devHeaders('tenant-1'), body: JSON.stringify({ ...base, platform: 'bogus' }),
    }));
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ ok: false, error: 'invalid import envelope' });
  });
});
