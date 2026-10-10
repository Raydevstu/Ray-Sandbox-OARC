import process from 'node:process';
import { Pool } from 'pg';

const baseUrl = (process.env.SLO_BASE_URL ?? 'http://127.0.0.1:3028').replace(/\/$/, '');
const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? 'postgresql://staging:staging_local_only@127.0.0.1:5443/ray_sandbox_staging';
const iterations = Math.max(20, Number(process.env.SLO_ITERATIONS ?? 200));
const concurrency = Math.max(1, Number(process.env.SLO_CONCURRENCY ?? 8));
const scope = { tenantId: process.env.SLO_TENANT_ID ?? 'staging-tenant', bankId: process.env.SLO_BANK_ID ?? 'staging-bank', projectId: process.env.SLO_PROJECT_ID ?? 'staging-project' };
const percentile = (values, rank) => { const ordered = [...values].sort((a, b) => a - b); return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * rank) - 1)] ?? 0; };
const summary = (samples) => ({ p50Ms: Number(percentile(samples, 0.5).toFixed(2)), p95Ms: Number(percentile(samples, 0.95).toFixed(2)), p99Ms: Number(percentile(samples, 0.99).toFixed(2)), maxMs: Number(Math.max(...samples, 0).toFixed(2)) });
const runId = `slo-${Date.now()}`;
const devHeaders = { 'content-type': 'application/json', 'x-dev-subject': 'slo-workload', 'x-dev-tenant-id': scope.tenantId, 'x-dev-scopes': 'events:write memory:read memory:write jobs:claim' };

const call = async (path, body, headers = { 'content-type': 'application/json' }) => {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const payload = await response.json();
    return { response, payload, latencyMs: performance.now() - started };
  } catch (error) {
    return { response: { ok: false, status: 0 }, payload: { ok: false, error: error instanceof Error ? error.message : String(error) }, latencyMs: performance.now() - started };
  }
};

const runBatches = async (count, operation, batchSize = concurrency) => {
  const results = [];
  for (let start = 0; start < count; start += batchSize) results.push(...await Promise.all(Array.from({ length: Math.min(batchSize, count - start) }, (_, offset) => operation(start + offset))));
  return results;
};

const startedAt = new Date();
const retainResults = await runBatches(iterations, (index) => call('/api/v1/memory/retain', { tenantId: scope.tenantId, bankId: scope.bankId, content: `SLO workload fact ${runId}-${index}: PostgreSQL remains the canonical persistence store.`, source: 'slo-workload', provenance: 'local-measured-workload', idempotencyKey: `${runId}-retain-${index}` }), 1);
const recallResults = await runBatches(iterations, () => call('/api/v1/memory/recall', { tenantId: scope.tenantId, bankId: scope.bankId, query: 'canonical PostgreSQL persistence store', limit: 10 }));
const eventResults = await runBatches(iterations, (index) => call('/api/project-memory/codex-event', { tenantId: scope.tenantId, bankId: scope.bankId, projectId: scope.projectId, conversationId: runId, messageId: `${runId}-event-${index}`, timestamp: new Date().toISOString(), kind: 'mcp-call', method: 'conversation/message', name: 'slo-workload', role: index % 2 ? 'assistant' : 'user', content: `Measured worker workload ${runId}-${index}: preserve evidence and event-ledger lineage.` }, devHeaders), 1);

const failed = (results) => results.filter((result) => !result.response.ok || !result.payload.ok).length;
const failures = failed(retainResults) + failed(recallResults) + failed(eventResults);
const acceptedEvents = eventResults.filter((result) => result.response.ok && result.payload.ok).length;
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
let worker = { observed: false, within60s: false, total: 0, complete: 0, deadLetter: 0, completionRate: 0 };
let queueDelay = [];
try {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await pool.query(`SELECT j.status, j.available_at, j.claimed_at FROM jobs j JOIN project_events e ON e.tenant_id = j.tenant_id AND e.bank_id = j.bank_id AND e.id = j.event_id WHERE j.tenant_id = $1 AND j.bank_id = $2 AND e.project_id = $3 AND j.available_at >= $4`, [scope.tenantId, scope.bankId, scope.projectId, startedAt]);
    const rows = result.rows;
    if (acceptedEvents > 0 && rows.length >= acceptedEvents && rows.every((row) => row.status === 'complete' || row.status === 'dead-letter')) {
      queueDelay = rows.filter((row) => row.claimed_at).map((row) => Math.max(0, new Date(row.claimed_at).getTime() - new Date(row.available_at).getTime()));
      const complete = rows.filter((row) => row.status === 'complete').length;
      const deadLetter = rows.filter((row) => row.status === 'dead-letter').length;
      worker = { observed: rows.length > 0, within60s: deadLetter === 0 && complete === rows.length, total: rows.length, complete, deadLetter, completionRate: complete / Math.max(1, rows.length) };
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
} finally { await pool.end(); }

const report = { baseUrl, iterations, concurrency, scope, retain: summary(retainResults.map((result) => result.latencyMs)), recall: summary(recallResults.map((result) => result.latencyMs)), queueDelay: summary(queueDelay), worker, failures: { total: failures, retain: failed(retainResults), recall: failed(recallResults), events: failed(eventResults) }, gates: { retainP95Under250ms: percentile(retainResults.map((result) => result.latencyMs), 0.95) < 250, recallP95Under500ms: percentile(recallResults.map((result) => result.latencyMs), 0.95) < 500, workerCompletionWithin60s: worker.observed && worker.within60s && worker.completionRate >= 0.99 } };
console.log(JSON.stringify(report));
if (failures > 0 || !report.gates.retainP95Under250ms || !report.gates.recallP95Under500ms || !report.gates.workerCompletionWithin60s) process.exitCode = 1;
