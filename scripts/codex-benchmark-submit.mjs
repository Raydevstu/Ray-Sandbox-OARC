import { readFile } from 'node:fs/promises';

const inputPath = process.argv[2];
const endpoint = process.env.CODEX_BENCHMARK_ENDPOINT;
const tenantId = process.env.CODEX_TENANT_ID;
const bankId = process.env.CODEX_BANK_ID;
const projectId = process.env.CODEX_PROJECT_ID;
const authorization = process.env.CODEX_AUTHORIZATION;

if (!inputPath || !endpoint || !tenantId || !bankId || !projectId) {
  console.error('Usage: node scripts/codex-benchmark-submit.mjs <run.json> with CODEX_BENCHMARK_ENDPOINT, CODEX_TENANT_ID, CODEX_BANK_ID, and CODEX_PROJECT_ID set.');
  process.exit(2);
}

const run = JSON.parse(await readFile(inputPath, 'utf8'));
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
  body: JSON.stringify({ tenantId, bankId, projectId, run }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok || !body.ok) {
  console.error(`Benchmark submission failed (${response.status}): ${typeof body.error === 'string' ? body.error : 'server rejected the request'}`);
  process.exit(1);
}

const modes = body.data?.summary ? Object.keys(body.data.summary) : [];
console.log(JSON.stringify({ ok: true, runId: body.data?.run?.id ?? null, evidence: body.data?.run?.evidence ?? null, modes }));
