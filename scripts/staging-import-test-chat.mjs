import process from 'node:process';

const baseUrl = process.env.STAGING_BASE_URL ?? 'http://127.0.0.1:3028';
const scope = { tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: 'staging-project' };
const conversationId = 'synthetic-memory-app-test-chat';
const headers = { 'content-type': 'application/json', 'x-dev-subject': 'synthetic-chat-import', 'x-dev-tenant-id': scope.tenantId, 'x-dev-scopes': 'events:write memory:read memory:write' };
const messages = [
  'Scenario: We are building a customer-support dashboard. CSV import and dashboard layout are complete. Search works but filtering is slow above 10,000 records. Launch target is October 30, 2026. Decision under discussion: optimize search before launch or defer it.',
  'Decision approved: optimize search before launch. Owner: Engineering team. Expected effort: 3–5 days. Reason: protect customer-support usability. Risk accepted: possible delay to lower-priority features.',
  'Progress: search optimization completed. Filtering reaches 350 ms against a 500 ms target. Decision approved: accept the 25% memory increase. Follow-up: monitor memory usage in staging and production testing.',
  'Issue: staging CSV imports fail on duplicate customer IDs. Decision approved: reject duplicate rows, preserve the first valid record, and generate an import warning report.',
  'Progress: duplicate handling, warning report, CSV tests, permissions, staging validation, rollback instructions, and deployment setup are complete. Overall progress: 100%. Launch readiness: approved.',
  'Final decision: proceed with the planned launch on October 30, 2026. Accepted risk: 25% higher memory usage. Monitor memory usage and customer-support performance after launch. Roll back search optimization if instability occurs.',
];

for (const [index, content] of messages.entries()) {
  const timestamp = new Date(Date.UTC(2026, 9, 9, 10, index, 0)).toISOString();
  const response = await fetch(`${baseUrl}/api/project-memory/codex-event`, {
    method: 'POST', headers,
    body: JSON.stringify({ ...scope, conversationId, messageId: `synthetic-chat-${index + 1}`, timestamp, kind: 'mcp-call', method: 'conversation/message', name: 'synthetic-chat-import', role: index % 2 === 0 ? 'user' : 'assistant', content }),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  console.log(`PASS message ${index + 1}/${messages.length} queued`);
}
console.log('PASS synthetic test chat submitted');
