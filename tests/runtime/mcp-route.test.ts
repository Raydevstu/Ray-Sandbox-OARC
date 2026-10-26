import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../app/api/mcp/route';
import { runtimeMetrics } from '../../lib/runtime/live-metrics';
import { projectDashboardMetrics } from '../../lib/runtime/project-dashboard-metrics';

const headers = {
  'content-type': 'application/json',
  'x-dev-subject': 'agent-a',
  'x-dev-tenant-id': 'tenant-a',
  'x-dev-scopes': 'memory:read',
  'x-dev-allowed-project-ids': 'project-a',
};
const context = {
  provider: 'hermes',
  agentId: 'hermes-agent-a',
  tenantId: 'tenant-a',
  bankId: 'bank-a',
  projectId: 'project-a',
  conversationId: 'conversation-a',
};
const request = (body: Record<string, unknown>, sessionId?: string) => new Request('http://localhost/api/mcp', {
  method: 'POST',
  headers: { ...headers, ...(sessionId ? { 'mcp-session-id': sessionId } : {}) },
  body: JSON.stringify(body),
});

describe('governed MCP JSON-RPC route', () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = 'true';
  });

  it('binds initialization context and discovers only read tools', async () => {
    const initialize = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: context }));
    const sessionId = initialize.headers.get('MCP-Session-Id');

    expect(initialize.status).toBe(200);
    expect(sessionId).toBeTruthy();

    const initialized = await POST(request({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, sessionId ?? undefined));
    expect(initialized.status).toBe(202);

    const tools = await POST(request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sessionId ?? undefined));

    await expect(tools.json()).resolves.toMatchObject({
      result: {
        tools: [
          { name: 'memory_recall' },
          { name: 'memory_trace' },
          { name: 'memory_get_project_state' },
          { name: 'memory_get_capture_status' },
        ],
      },
    });
  });

  it('rejects missing connector context before creating a session', async () => {
    const response = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32602 } });
  });

  it('rejects an MCP initialization for a project outside the authenticated allow-list', async () => {
    const response = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { ...context, projectId: 'project-b' } }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { message: 'access denied' } });
  });

  it('rejects a mutation tool before repository access', async () => {
    const before = runtimeMetrics.snapshot().operations.mcp;
    const initialize = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: context }));
    const sessionId = initialize.headers.get('MCP-Session-Id');
    const response = await POST(request({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'memory_retain', arguments: { correlationId: 'corr-a' } } }, sessionId ?? undefined));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32602 } });
    expect(runtimeMetrics.snapshot().operations.mcp).toBe(before + 1);
    expect(runtimeMetrics.snapshot().failures).toBeGreaterThan(0);
    expect(projectDashboardMetrics.snapshot({ tenantId: 'tenant-a', bankId: 'bank-a', projectId: 'project-a' }).operations.mcp).toBeGreaterThan(0);
  });

  it('rejects malformed JSON-RPC requests', async () => {
    const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST', headers, body: JSON.stringify({ method: 'tools/list' }) }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32700 } });
  });
});
