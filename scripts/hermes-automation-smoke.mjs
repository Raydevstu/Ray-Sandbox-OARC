#!/usr/bin/env node

const endpoint = process.env.RAY_MEMORY_MCP_URL ?? 'http://127.0.0.1:3030/api/mcp';
const projectId = process.env.RAY_MEMORY_PROJECT_ID ?? 'ray-dashboard-test';
const context = {
  provider: 'hermes',
  agentId: process.env.RAY_MEMORY_AGENT_ID ?? 'hermes-automation-smoke',
  tenantId: process.env.RAY_MEMORY_TENANT_ID ?? 'demo-tenant',
  bankId: process.env.RAY_MEMORY_BANK_ID ?? 'bank-a',
  projectId,
  conversationId: `hermes-automation-smoke-${Date.now()}`,
};
const headers = {
  'content-type': 'application/json',
  'x-dev-subject': context.agentId,
  'x-dev-tenant-id': context.tenantId,
  'x-dev-scopes': 'memory:read memory:write',
  'x-dev-allowed-project-ids': projectId,
};
let nextId = 1;
let sessionId;

async function call(method, params = {}) {
  const request = { jsonrpc: '2.0', id: nextId++, method, params: method === 'initialize' ? { ...context, ...params } : params };
  const requestHeaders = { ...headers };
  if (sessionId) requestHeaders['mcp-session-id'] = sessionId;
  const response = await fetch(endpoint, { method: 'POST', headers: requestHeaders, body: JSON.stringify(request) });
  const returnedSessionId = response.headers.get('mcp-session-id');
  if (returnedSessionId) sessionId = returnedSessionId;
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`${method} failed: HTTP ${response.status} ${JSON.stringify(body.error ?? body)}`);
  return body.result;
}

const correlationId = `hermes-automation-${Date.now()}`;
const initialized = await call('initialize', { capabilities: {} });
if (!initialized?.serverInfo) throw new Error('initialize returned no serverInfo');
await call('notifications/initialized');
const retainCorrelationId = `${correlationId}-retain`;
const retained = await call('tools/call', {
  name: 'memory_retain',
  arguments: {
    content: 'Hermes automation smoke retained fact',
    source: 'hermes-automation-smoke',
    provenance: 'controlled local integration test',
    idempotencyKey: `${correlationId}-idempotency`,
    correlationId: retainCorrelationId,
  },
});
const status = await call('tools/call', { name: 'memory_get_capture_status', arguments: { correlationId } });
const state = await call('tools/call', { name: 'memory_get_project_state', arguments: { correlationId } });
const recall = await call('tools/call', { name: 'memory_recall', arguments: { query: 'Hermes automation smoke retained fact', limit: 3, correlationId } });

const text = (value) => value?.content?.map((item) => item.text ?? '').join(' ') ?? '';
const statusText = text(status);
const stateText = text(state);
const recallText = text(recall);
const retainedText = text(retained);
if (!statusText || !stateText || !recallText || !retainedText) throw new Error('one or more MCP tools returned empty content');
const recallPayload = JSON.parse(recallText);
if (!Array.isArray(recallPayload.facts) || !recallPayload.facts.some((fact) => String(fact.content ?? '').includes('Hermes automation smoke retained fact'))) {
  throw new Error('retained fact was not visible through MCP recall');
}
process.stdout.write(`${JSON.stringify({ ok: true, endpoint, projectId, checks: ['initialize', 'initialized-notification', 'retain', 'capture-status', 'project-state', 'worker-complete', 'recall-visible'] })}\n`);
