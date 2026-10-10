import process from 'node:process';
import { Pool } from 'pg';

const baseUrl = process.env.STAGING_BASE_URL ?? 'http://127.0.0.1:3028';
const databaseUrl = process.env.STAGING_DATABASE_URL ?? 'postgresql://staging:staging_local_only@127.0.0.1:5443/ray_sandbox_staging';
const scope = { tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: 'staging-project' };
const headers = { 'content-type': 'application/json', 'x-dev-subject': 'staging-validation', 'x-dev-tenant-id': scope.tenantId, 'x-dev-scopes': 'events:write memory:read memory:write' };
const check = async (name, operation) => { try { await operation(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await check('health endpoint', async () => { const response = await fetch(`${baseUrl}/api/v1/health`); if (!response.ok) throw new Error(`HTTP ${response.status}`); });
await check('meaningful worker event', async () => {
  const response = await fetch(`${baseUrl}/api/project-memory/codex-event`, { method: 'POST', headers, body: JSON.stringify({ ...scope, conversationId: 'staging-validation', messageId: `staging-${Date.now()}`, timestamp: new Date().toISOString(), kind: 'mcp-call', method: 'conversation/message', name: 'staging-validation', role: 'user', content: 'Requirement: staging must preserve provenance for every canonical project memory record.' }) });
  const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`); if (!['queued', 'processed'].includes(body.data?.capture?.state)) throw new Error('capture lifecycle did not reach queued or processed');
});
await check('import capture lifecycle', async () => {
  const response = await fetch(`${baseUrl}/api/project-memory/import`, { method: 'POST', headers, body: JSON.stringify({ ...scope, platform: 'codex', conversationId: 'staging-import-lifecycle', exportedAt: new Date().toISOString(), sourceReference: 'staging-validation/import-lifecycle', messages: [{ id: `staging-import-${Date.now()}`, role: 'user', content: 'Requirement: imported Codex messages must expose lifecycle status.' }] }) });
  const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`); if (!['queued', 'processed'].includes(body.data?.capture?.state)) throw new Error('import capture lifecycle did not reach queued or processed');
});
const pool = new Pool({ connectionString: databaseUrl });
try {
  await check('worker completion', async () => { for (let attempt = 0; attempt < 20; attempt += 1) { const result = await pool.query("SELECT status FROM jobs WHERE tenant_id = $1 AND bank_id = $2 ORDER BY updated_at DESC LIMIT 1", [scope.tenantId, scope.bankId]); if (result.rows[0]?.status === 'complete') return; if (result.rows[0]?.status === 'dead-letter') throw new Error('latest job is dead-lettered'); await sleep(250); } throw new Error('worker did not complete within five seconds'); });
  await check('canonical provenance', async () => { const result = await pool.query("SELECT evidence FROM project_memory_records WHERE tenant_id = $1 AND bank_id = $2 AND project_id = $3 LIMIT 1", [scope.tenantId, scope.bankId, scope.projectId]); if (!result.rows[0]?.evidence) throw new Error('canonical record or evidence missing'); });
} finally { await pool.end(); }
