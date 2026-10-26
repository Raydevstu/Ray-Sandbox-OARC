import fs from 'node:fs/promises';
import process from 'node:process';

const file = process.env.CODEX_EXPORT_FILE ?? process.argv[2];
if (!file) throw new Error('Provide a JSON or JSONL export path: npm run codex:bridge -- .\\codex-export.jsonl');
const baseUrl = process.env.CODEX_BRIDGE_ENDPOINT ?? 'http://127.0.0.1:3028/api/project-memory/codex-event';
const scope = { tenantId: process.env.CODEX_TENANT_ID ?? 'staging-tenant', bankId: process.env.CODEX_BANK_ID ?? 'staging-bank', projectId: process.env.CODEX_PROJECT_ID ?? 'staging-project' };
const conversationId = process.env.CODEX_CONVERSATION_ID ?? `export-${Date.now()}`;
const raw = await fs.readFile(file, 'utf8');
const parsed = file.endsWith('.jsonl') ? raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : file.endsWith('.json') ? JSON.parse(raw) : [{ role: 'user', content: raw }];
const messages = Array.isArray(parsed) ? parsed : Array.isArray(parsed.messages) ? parsed.messages : [parsed];
const secretKey = /token|secret|password|authorization|api[-_]?key/i;
const redact = (value) => Array.isArray(value) ? value.map(redact) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? '[REDACTED_SECRET]' : redact(item)])) : value;
const content = (message) => typeof message.content === 'string' ? message.content : typeof message.text === 'string' ? message.text : JSON.stringify(message.content ?? message.text ?? message);
for (const [index, message] of messages.entries()) {
  const messageId = String(message.id ?? message.uuid ?? `export-message-${index + 1}`);
  const response = await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.CODEX_AUTHORIZATION ? { authorization: process.env.CODEX_AUTHORIZATION } : { 'x-dev-subject': 'codex-host-bridge', 'x-dev-tenant-id': scope.tenantId, 'x-dev-scopes': 'events:write memory:read memory:write' }) }, body: JSON.stringify({ ...scope, conversationId, messageId, timestamp: message.timestamp ?? message.createdAt ?? new Date().toISOString(), kind: 'mcp-call', method: 'conversation/message', name: 'codex-export', role: ['user', 'assistant', 'tool', 'system'].includes(message.role) ? message.role : 'assistant', content: content(redact(message)) }) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Message ${index + 1} failed: ${result.error ?? `HTTP ${response.status}`}`);
  console.log(`PASS message ${index + 1}/${messages.length} accepted`);
}
console.log(`PASS export bridge completed (${messages.length} messages)`);
