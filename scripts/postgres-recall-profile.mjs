import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { summarizeRecallLeaseFairness, summarizeRecallServerTimings } from '../lib/runtime/recall-timing-report.ts';

const baseUrl = (process.env.SLO_BASE_URL ?? 'http://127.0.0.1:3028').replace(/\/$/, '');
const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? 'postgresql://staging:staging_local_only@127.0.0.1:5443/ray_sandbox_staging';
const concurrency = Math.max(1, Number(process.env.SLO_CONCURRENCY ?? 100));
const tenantId = process.env.SLO_TENANT_ID ?? 'staging-tenant';
const bankId = process.env.SLO_BANK_ID ?? 'staging-bank';
const projectId = process.env.SLO_PROJECT_ID ?? 'tier15-profile-100-20261023';
const reportPath = process.env.SLO_REPORT_PATH?.trim();
const recallLimit = Math.max(1, Math.min(100, Number(process.env.SLO_RECALL_LIMIT ?? 10)));
const projection = process.env.SLO_RECALL_PROJECTION === 'summary' ? 'summary' : 'full';
const headers = { 'content-type': 'application/json', 'x-dev-subject': 'postgres-recall-profile', 'x-dev-tenant-id': tenantId, 'x-dev-scopes': 'memory:read' };
const query = 'canonical PostgreSQL persistence store';
const terms = ['%canonical%', '%postgresql%', '%persistence%', '%store%'];
const serverTimings = [];
const percentile = (values, rank) => { const ordered = [...values].sort((a, b) => a - b); return Number((ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * rank) - 1)] ?? 0).toFixed(2)); };

const planSql = `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT TEXT)
WITH candidates AS (
  SELECT f.id, f.tenant_id, f.bank_id, f.project_id, f.revision, f.claim, f.confidence, f.created_at
  FROM facts f
  WHERE f.tenant_id = $1 AND f.bank_id = $2 AND f.project_id = $3
    AND f.claim ILIKE ANY($4::text[])
    AND NOT EXISTS (SELECT 1 FROM deleted_facts d WHERE d.tenant_id = f.tenant_id AND d.bank_id = f.bank_id AND d.fact_id = f.id)
  ORDER BY f.revision DESC LIMIT ${recallLimit}
)
SELECT c.id, c.tenant_id, c.bank_id, c.project_id, c.revision, c.claim, c.confidence, c.created_at,
  COALESCE(json_agg(fe.evidence_id) FILTER (WHERE fe.evidence_id IS NOT NULL), '[]')
FROM candidates c
LEFT JOIN fact_evidence fe ON fe.tenant_id = c.tenant_id AND fe.bank_id = c.bank_id AND fe.fact_id = c.id AND fe.fact_revision = c.revision
GROUP BY c.id, c.tenant_id, c.bank_id, c.project_id, c.revision, c.claim, c.confidence, c.created_at
ORDER BY c.revision DESC`;

const callRecall = async () => {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/v1/memory/recall`, { method: 'POST', headers, body: JSON.stringify({ tenantId, bankId, projectId, query, limit: recallLimit, projection }) });
  const timing = response.headers.get('server-timing');
  if (timing) serverTimings.push(timing);
  const body = await response.text();
  const payload = JSON.parse(body);
  const facts = payload.data?.facts ?? [];
  return { ok: response.ok, status: response.status, latencyMs: performance.now() - started, facts: facts.length, evidence: facts.reduce((total, fact) => total + (fact.evidenceIds?.length ?? 0), 0), bytes: new TextEncoder().encode(body).byteLength };
};

const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 3000 });
const directQuery = 'SELECT f.id, f.claim FROM facts f WHERE f.tenant_id = $1 AND f.bank_id = $2 AND f.project_id = $3 AND f.claim ILIKE ANY($4::text[]) ORDER BY f.revision DESC LIMIT 10';
const activity = [];
let polling = true;
const poll = (async () => {
  while (polling) {
    const result = await pool.query(`SELECT state, COALESCE(wait_event_type, '') AS wait_event_type, COALESCE(wait_event, '') AS wait_event, count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() GROUP BY state, wait_event_type, wait_event ORDER BY count(*) DESC`);
    activity.push({ at: new Date().toISOString(), states: result.rows });
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
})();

try {
  const plan = await pool.query(planSql, [tenantId, bankId, projectId, terms]);
  const directPool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 3000 });
  const directStarted = performance.now();
  const directResults = await Promise.all(Array.from({ length: concurrency }, async () => { const started = performance.now(); await directPool.query(directQuery, [tenantId, bankId, projectId, terms]); return performance.now() - started; }));
  await directPool.end();
  const started = new Date().toISOString();
  const results = await Promise.all(Array.from({ length: concurrency }, callRecall));
  polling = false;
  await poll;
  const latencies = results.map((result) => result.latencyMs);
  const waitStates = activity.flatMap((sample) => sample.states).filter((row) => row.wait_event_type || row.wait_event).reduce((counts, row) => { const key = `${row.wait_event_type}:${row.wait_event}`; counts[key] = (counts[key] ?? 0) + Number(row.count); return counts; }, {});
  const report = { baseUrl, started, concurrency, recallLimit, projection, scope: { tenantId, bankId, projectId }, query, directDatabase: { p50Ms: percentile(directResults, 0.5), p95Ms: percentile(directResults, 0.95), p99Ms: percentile(directResults, 0.99), maxMs: Number(Math.max(...directResults, 0).toFixed(2)), totalMs: Number((performance.now() - directStarted).toFixed(2)) }, request: { failures: results.filter((result) => !result.ok).length, p50Ms: percentile(latencies, 0.5), p95Ms: percentile(latencies, 0.95), p99Ms: percentile(latencies, 0.99), maxMs: Number(Math.max(...latencies, 0).toFixed(2)), factsP95: percentile(results.map((result) => result.facts), 0.95), evidenceP95: percentile(results.map((result) => result.evidence), 0.95), resultBytesP95: percentile(results.map((result) => result.bytes), 0.95), stageTimings: summarizeRecallServerTimings(serverTimings), leaseFairness: summarizeRecallLeaseFairness(serverTimings) }, serverTimingSamples: serverTimings.slice(0, 5), plan: plan.rows.map((row) => row['QUERY PLAN']), activitySamples: activity.length, waitStates };
  console.log(JSON.stringify(report, null, 2));
  if (reportPath) { const target = path.resolve(reportPath); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
  if (report.request.failures > 0) process.exitCode = 1;
} finally {
  polling = false;
  await pool.end();
}
