import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    pool: null as unknown,
    saveDistilledFacts: vi.fn(),
    deleteChatSessionFacts: vi.fn(),
    queries: [] as Array<{ text: string; params?: unknown[] }>,
    importConversationExport: vi.fn(),
    persistCodexProjectEvent: vi.fn(),
    repoAppend: vi.fn(),
    capturedEvent: null as unknown,
    dispatcher: { enqueueAsync: vi.fn(async () => true) },
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
    importConversationExport: state.importConversationExport,
    persistCodexProjectEvent: state.persistCodexProjectEvent,
    getCapturedEvent: () => state.capturedEvent,
    setCapturedEvent: (e: unknown) => { state.capturedEvent = e; },
    repoAppend: state.repoAppend,
    dispatcher: state.dispatcher,
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
vi.mock('../../lib/runtime/repository', () => ({
  createRuntimeRepository: vi.fn(() => ({
    listProjectEvents: vi.fn(async () => []),
    appendProjectEventNextSequence: vi.fn(async (event: unknown) => { h.setCapturedEvent(event); return event; }),
  })),
  isRuntimeStoreConfigured: vi.fn(() => true),
}));
vi.mock('../../lib/runtime/project-memory-pipeline', () => ({
  createAsyncProjectMemoryDispatcher: vi.fn(() => h.dispatcher),
}));
vi.mock('../../lib/runtime/cross-platform-import', () => ({
  importConversationExport: (...args: unknown[]) => h.importConversationExport(...args),
  unavailableImport: vi.fn(),
}));
vi.mock('../../lib/runtime/codex-ingestion', () => ({
  normalizeCodexMcpEvent: vi.fn(),
  normalizeCodexToolEvent: vi.fn(),
  persistCodexProjectEvent: (...args: unknown[]) => h.persistCodexProjectEvent(...args),
}));

import { POST as hermesPushPOST } from '../../app/api/v1/memory/hermes-push/route';
import { POST as importPOST } from '../../app/api/project-memory/import/route';
import { POST as codexEventPOST } from '../../app/api/project-memory/codex-event/route';
import { redactIncoming, isSecretPath } from '../../lib/server/redaction';
import { resetCaptureStatus } from '../../lib/runtime/capture-status';
import { SECRET_LINES, BENIGN_LINES, HIGH_ENTROPY_SECRET, SECRET_PATHS, BENIGN_PATHS } from './fixtures/redaction-corpus';

const LONG_CONTENT = 'We decided to use PostgreSQL for the second brain store because the previous file based approach did not scale past a single repository. The migration will keep the existing schema and add the lifecycle tables. We will run the backup script nightly and verify the restore path before enabling retention.';

const devHeaders = {
  'content-type': 'application/json',
  'x-dev-subject': 'hermes',
  'x-dev-tenant-id': 'tenant-1',
  'x-dev-bank-id': 'bank-1',
  'x-dev-project-id': 'project-1',
  'x-dev-scopes': 'memory:read memory:write events:write',
};

const postRequest = (url: string, body: unknown) => new Request(`http://localhost${url}`, { method: 'POST', headers: devHeaders, body: JSON.stringify(body) });

describe('hub-side L3 redaction', () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true';
    h.setPool(null);
    h.saveDistilledFacts.mockReset();
    h.deleteChatSessionFacts.mockReset();
    h.queries.length = 0;
    h.importConversationExport.mockReset();
    h.persistCodexProjectEvent.mockReset();
    h.dispatcher.enqueueAsync.mockReset().mockResolvedValue(true);
    h.state.capturedEvent = null;
    resetCaptureStatus();
  });

  afterEach(() => {
    delete process.env.APEX_DATABASE_URL;
  });

  it('drops every secret line from the shared corpus and keeps benign lines byte-identical', () => {
    for (const line of SECRET_LINES) {
      const { payload, skipped } = redactIncoming({ text: line });
      expect(skipped, line).toBeGreaterThan(0);
      expect(JSON.stringify(payload)).not.toContain(line);
    }
    for (const line of BENIGN_LINES) {
      const { payload, skipped } = redactIncoming({ text: line });
      expect(skipped, line).toBe(0);
      expect((payload as { text: string }).text).toBe(line);
    }
    const high = redactIncoming({ text: HIGH_ENTROPY_SECRET });
    expect(high.skipped).toBe(1);
  });

  it('deep-redacts nested payloads and counts skipped lines', () => {
    const secret = SECRET_LINES[0];
    const { payload, skipped } = redactIncoming({ messages: [{ role: 'user', content: secret }], tenantId: 'tenant-1' });
    expect(skipped).toBe(1);
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect((payload as { messages: Array<{ content: string }> }).messages[0].content).not.toContain(secret);
  });

  it('flags secret-bearing paths via the shared L1 list', () => {
    for (const p of SECRET_PATHS) expect(isSecretPath(p)).toBe(true);
    for (const p of BENIGN_PATHS) expect(isSecretPath(p)).toBe(false);
  });

  it('redacts the hermes-push transcript before hashing, dedup, and persisting', async () => {
    h.setPool(h.fakePool);
    const secretLine = 'password=hunter2';
    const contentWithSecret = `${LONG_CONTENT}\n${secretLine}`;
    const pushHeaders = { ...devHeaders, 'x-dev-bank-id': 'secondosaistudioog' };
    const response = await hermesPushPOST(new Request('http://localhost/api/v1/memory/hermes-push', {
      method: 'POST',
      headers: pushHeaders,
      body: JSON.stringify({
        tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1',
        cwd: 'D:/Projects/Secondosaistudioog', sessionId: 'ses_redact_push',
        messages: [{ role: 'user', content: contentWithSecret, timestamp: 1 }],
      }),
    }));
    expect(response.status).toBe(201);

    // Raw evidence row (hermes-push source) must not contain the secret line.
    const rawInsert = h.queries.find((q) => q.text.includes("VALUES ($1, $2, $3, $4, 'hermes-push'"));
    expect(rawInsert).toBeDefined();
    expect(String(rawInsert?.params?.[4])).not.toContain(secretLine);

    const saveCall = h.saveDistilledFacts.mock.calls[0];
    expect(saveCall).toBeDefined();
    const facts = saveCall[3] as Array<{ content: string }>;
    expect(JSON.stringify(facts)).not.toContain(secretLine);
  });

  it('redacts the import envelope before hashing, dedup, and persisting', async () => {
    h.importConversationExport.mockReturnValue({ events: [], gaps: [] });
    const secret = SECRET_LINES[0];
    const envelope = {
      tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', workspacePath: 'D:/Projects/Secondosaistudioog',
      platform: 'opencode', conversationId: 'ses_redact_import', exportedAt: '2026-11-15T00:00:00.000Z', sourceReference: 'ref-1',
      messages: [{ role: 'user', content: secret, timestamp: '2026-11-15T00:00:00.000Z' }],
    };
    const response = await importPOST(postRequest('/api/project-memory/import', envelope));
    expect(response.status).toBe(200);
    expect(h.importConversationExport).toHaveBeenCalledTimes(1);
    const [, sent] = h.importConversationExport.mock.calls[0];
    expect(JSON.stringify(sent)).not.toContain(secret);
  });

  it('redacts the codex event before hashing, dedup, and persisting', async () => {
    const { normalizeCodexMcpEvent } = await import('../../lib/runtime/codex-ingestion');
    (normalizeCodexMcpEvent as any).mockImplementation((_scope: any, _meta: any, call: any) => ({
      id: `evt-${call.messageId}`,
      type: 'CodexMcpCall',
      payload: { conversation: { messageId: call.messageId, content: call.content } },
    }));
    h.persistCodexProjectEvent.mockImplementation(async (_repo: any, event: any) => ({ event, duplicate: false, queued: false }));
    const secret = SECRET_LINES[0];
    const response = await codexEventPOST(postRequest('/api/project-memory/codex-event', {
      tenantId: 'tenant-1', bankId: 'bank-1', projectId: 'project-1', conversationId: 'ses_redact_codex', messageId: 'm-redact-1',
      timestamp: '2026-11-15T00:00:00.000Z', kind: 'mcp-call', method: 'tools/call', name: 'read_file', role: 'user', content: secret,
    }));
    expect(response.status).toBe(200);
    expect(h.persistCodexProjectEvent).toHaveBeenCalledTimes(1);
    const persistedEvent = h.persistCodexProjectEvent.mock.calls[0][1];
    expect(JSON.stringify(persistedEvent)).not.toContain(secret);
  });
});
