#!/usr/bin/env node

import readline from 'node:readline';

const endpoint = process.env.RAY_MEMORY_MCP_URL ?? 'http://127.0.0.1:3030/api/mcp';
const context = {
  provider: 'hermes',
  agentId: process.env.RAY_MEMORY_AGENT_ID ?? 'hermes-ray-dashboard-test',
  tenantId: process.env.RAY_MEMORY_TENANT_ID ?? 'demo-tenant',
  bankId: process.env.RAY_MEMORY_BANK_ID ?? 'bank-a',
  projectId: process.env.RAY_MEMORY_PROJECT_ID ?? 'ray-dashboard-test',
  conversationId: process.env.RAY_MEMORY_CONVERSATION_ID ?? `hermes-${Date.now()}`,
};
const headers = {
  'content-type': 'application/json',
  'x-dev-subject': context.agentId,
  'x-dev-tenant-id': context.tenantId,
  'x-dev-scopes': process.env.RAY_MEMORY_SCOPES ?? 'memory:read',
  'x-dev-allowed-project-ids': context.projectId,
};
let sessionId;

const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

async function forward(message) {
  const params = message.params ? { ...message.params } : {};
  if (message.method === 'initialize') Object.assign(params, context);
  const requestHeaders = { ...headers };
  if (sessionId) requestHeaders['mcp-session-id'] = sessionId;
  const response = await fetch(endpoint, { method: 'POST', headers: requestHeaders, body: JSON.stringify({ ...message, params }) });
  const nextSessionId = response.headers.get('mcp-session-id');
  if (nextSessionId) sessionId = nextSessionId;
  const text = await response.text();
  if (!text) return;
  try { write(JSON.parse(text)); } catch { write({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: `Ray Memory returned HTTP ${response.status}` } }); }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let pending = Promise.resolve();
input.on('line', (line) => {
  if (!line.trim()) return;
  pending = pending.then(() => forward(JSON.parse(line))).catch((error) => {
    process.stderr.write(`Ray Memory Hermes proxy error: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  });
});
