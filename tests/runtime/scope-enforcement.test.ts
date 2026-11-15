import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    pool: null as unknown,
    queries: [] as Array<{ text: string; params?: unknown[] }>,
    factRows: [] as Array<Record<string, unknown>>,
    importConversationExport: vi.fn(),
    persistCodexProjectEvent: vi.fn(),
    dispatcher: { enqueueAsync: vi.fn(async () => true) },
  };
  const fakePool = {
    query: async (text: string, params?: unknown[]) => {
      state.queries.push({ text, params });
      // recall facts query
      if (text.includes('FROM facts f WHERE f.tenant_id = $1 AND f.bank_id = $2')) {
        return { rows: state.factRows };
      }
      // bank-watch-path lookup
      if (text.includes("SELECT bank_id, provenance FROM evidence WHERE tenant_id = $1 AND source = 'bank-watch-path'")) {
        return {
          rows: [
            { bank_id: 'bank-a', provenance: JSON.stringify({ cwd: 'D:/Projects/ProjectA', path: 'D:/Projects/ProjectA' }) },
            { bank_id: 'bank-b', provenance: JSON.stringify({ cwd: 'D:/Projects/ProjectB', path: 'D:/Projects/ProjectB' }) },
          ],
        };
      }
      return { rows: [] };
    },
  };
  return {
    state,
    fakePool,
    setPool: (p: unknown) => { state.pool = p; },
    getPool: () => state.pool,
  };
});

vi.mock('../../lib/server/pg-client', () => ({
  getPgPool: () => h.getPool(),
  ensureSchema: async () => undefined,
}));
vi.mock('../../lib/server/pg-lifecycle', () => ({
  saveDecisionTrace: vi.fn(async () => undefined),
}));
vi.mock('../../lib/runtime/repository', () => ({
  createRuntimeRepository: vi.fn(() => ({
    listProjectEvents: vi.fn(async () => []),
    appendProjectEventNextSequence: vi.fn(async (event: unknown) => event),
  })),
  isRuntimeStoreConfigured: vi.fn(() => true),
}));
vi.mock('../../lib/runtime/project-memory-pipeline', () => ({
  createAsyncProjectMemoryDispatcher: vi.fn(() => h.state.dispatcher),
}));
vi.mock('../../lib/runtime/cross-platform-import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/runtime/cross-platform-import')>();
  return {
    ...actual,
    importConversationExport: (...args: unknown[]) => h.state.importConversationExport(...args),
  };
});
vi.mock('../../lib/runtime/codex-ingestion', () => ({
  normalizeCodexMcpEvent: vi.fn(),
  normalizeCodexToolEvent: vi.fn(),
  persistCodexProjectEvent: (...args: unknown[]) => h.state.persistCodexProjectEvent(...args),
}));

import { POST as recallPOST } from '../../app/api/v1/memory/recall/route';
import { POST as importPOST } from '../../app/api/project-memory/import/route';

const headers = (over: Record<string, string> = {}) => ({
  'content-type': 'application/json',
  'x-dev-subject': 'agent',
  'x-dev-tenant-id': 'tenant-1',
  'x-dev-bank-id': 'bank-a',
  'x-dev-project-id': 'project-a',
  'x-dev-scopes': 'memory:read memory:write events:write',
  ...over,
});

const recallReq = (body: Record<string, unknown>, hdrs = headers()) =>
  new Request('http://localhost/api/v1/memory/recall', { method: 'POST', headers: hdrs, body: JSON.stringify(body) });

const importReq = (body: Record<string, unknown>, hdrs = headers()) =>
  new Request('http://localhost/api/project-memory/import', { method: 'POST', headers: hdrs, body: JSON.stringify(body) });

describe('server-side scope enforcement (Task 11)', () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true';
    h.setPool(h.fakePool);
    h.state.queries.length = 0;
    h.state.factRows = [
      { entity: 'general', category: 'workflow', content: 'SECOND-BRAIN secret fact for project A', confidence: 0.9, importance: 90, occurrences: 1 },
    ];
    h.state.importConversationExport.mockReset();
    h.state.importConversationExport.mockReturnValue({
      events: [{ id: 'evt-1', projectId: 'project-a', payload: { conversation: { messageId: 'm1', timestamp: '2026-11-15T00:00:00.000Z' } }, occurredAt: '2026-11-15T00:00:00.000Z' }],
      gaps: [],
    });
    h.state.persistCodexProjectEvent.mockReset();
    h.state.persistCodexProjectEvent.mockResolvedValue({ queued: false, duplicate: false, event: { id: 'evt-1' } });
  });

  afterEach(() => {
    h.setPool(null);
  });

  it('(a) recall with tampered bank_id does not return facts from another bank', async () => {
    // Principal is scoped to bank-a/project-a but client asks for bank-b.
    const res = await recallPOST(recallReq({
      tenantId: 'tenant-1', bankId: 'bank-b', projectId: 'project-a',
      query: 'SECOND-BRAIN',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Must not leak bank-b facts; either empty/no cross-project data or scoped to allowed bank-a.
    expect(json?.data?.facts ?? json?.facts ?? []).toEqual([]);
    // If a bank-scoped query ran, it must target the enforced/allowed bank (bank-a), never bank-b.
    const factQuery = h.state.queries.find((q) => q.text.includes('FROM facts f WHERE f.tenant_id = $1 AND f.bank_id = $2'));
    if (factQuery) {
      expect(factQuery.params?.[1]).not.toBe('bank-b');
    }
  });

  it('(b) import with workspacePath resolving to another project bank is rejected', async () => {
    const res = await importPOST(importReq({
      tenantId: 'tenant-1', bankId: 'bank-a', projectId: 'project-a',
      workspacePath: 'D:/Projects/ProjectB',
      platform: 'opencode', conversationId: 'conv-1', exportedAt: '2026-11-15T00:00:00.000Z', sourceReference: 'ref-1',
      messages: [{ role: 'user', content: 'hello' }],
    }));
    expect([401, 403]).toContain(res.status);
  });

  it('(c) normal same-project flow succeeds end-to-end', async () => {
    // recall
    const r = await recallPOST(recallReq({
      tenantId: 'tenant-1', bankId: 'bank-a', projectId: 'project-a',
      query: 'SECOND-BRAIN',
    }));
    expect(r.status).toBe(200);
    const rj = await r.json();
    expect(rj.ok).toBe(true);
    expect(Array.isArray(rj?.data?.facts ?? rj?.facts)).toBe(true);
    expect((rj?.data?.facts ?? rj?.facts).length).toBeGreaterThan(0);

    // import
    const i = await importPOST(importReq({
      tenantId: 'tenant-1', bankId: 'bank-a', projectId: 'project-a',
      workspacePath: 'D:/Projects/ProjectA',
      platform: 'opencode', conversationId: 'conv-ok', exportedAt: '2026-11-15T00:00:00.000Z', sourceReference: 'ref-ok',
      messages: [{ role: 'user', content: 'hello from project a' }],
    }));
    expect(i.status).toBe(200);
    const ij = await i.json();
    expect(ij.ok).toBe(true);
  });

  it('(d) omitted filters derive from workspacePath and never leak another project facts', async () => {
    // No explicit bankId/projectId in body; principal provides tenant and workspacePath hint implies project A.
    const res = await recallPOST(recallReq({
      tenantId: 'tenant-1',
      query: 'SECOND-BRAIN',
      workspacePath: 'D:/Projects/ProjectA',
    }, headers({ 'x-dev-bank-id': 'bank-a', 'x-dev-project-id': 'project-a' })));
    expect(res.status).toBe(200);
    const json = await res.json();
    const factQuery = h.state.queries.find((q) => q.text.includes('FROM facts f WHERE f.tenant_id = $1 AND f.bank_id = $2'));
    if (factQuery) {
      expect(factQuery.params?.[1]).toBe('bank-a');
      expect(factQuery.params?.[1]).not.toBe('bank-b');
    }
    expect(json.ok === true || Array.isArray(json?.data?.facts ?? json?.facts)).toBe(true);
  });
});
