import { describe, expect, it } from 'vitest';
import { createMemoryApiClient } from '../../lib/runtime/sdk/client';
import { buildMcpTools } from '../../lib/runtime/mcp/tools';
import { buildIntegrationPayload } from '../../lib/runtime/integrations/adapters';

describe('memory integration contracts', () => {
  it('exposes retain, recall, get, and feedback through one client', async () => {
    const calls: string[] = [];
    const client = createMemoryApiClient({ request: async (path, init) => { calls.push(`${init?.method ?? 'GET'} ${path}`); return { ok: true, requestId: 'r1', data: { path } }; } });
    await client.retain({ tenantId: 't1', bankId: 'b1', content: 'x', source: 'test', provenance: 'unit', idempotencyKey: 'k' });
    await client.recall({ tenantId: 't1', bankId: 'b1', query: 'x' });
    await client.get('f1', { tenantId: 't1', bankId: 'b1' });
    await client.feedback({ tenantId: 't1', bankId: 'b1', factId: 'f1', useful: true });
    expect(calls).toEqual(['POST /api/v1/memory/retain', 'POST /api/v1/memory/recall', 'GET /api/v1/memory/f1?tenantId=t1&bankId=b1', 'POST /api/v1/memory/f1/feedback']);
  });

  it('maps MCP tools to the same client operations', () => {
    const tools = buildMcpTools({ retain: async () => ({ ok: true }), recall: async () => ({ ok: true }) });
    expect(tools.map((tool) => tool.name)).toEqual(['memory_retain', 'memory_recall']);
  });

  it('marks simulated integration payloads without secrets', () => {
    const payload = buildIntegrationPayload({ id: 'e1', type: 'MemoryRetained', tenantId: 't1', bankId: 'b1', payload: { token: 'secret', fact: 'f1' }, occurredAt: '2026-01-01T00:00:00.000Z' }, { kind: 'webhook', mode: 'simulated' });
    expect(payload.delivery).toBe('simulated');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });
});
