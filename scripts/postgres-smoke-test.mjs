import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
const baseUrl = process.env.APEX_SMOKE_BASE_URL?.trim() ?? 'http://127.0.0.1:3001';
const tenantId = process.env.APEX_SMOKE_TENANT_ID?.trim() ?? 'oarc-smoke-tenant';
const bankId = process.env.APEX_SMOKE_BANK_ID?.trim() ?? 'oarc-smoke-bank';

if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
  console.error('APEX_DATABASE_URL must be a PostgreSQL connection string.');
  process.exitCode = 2;
} else {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const migration = await readFile(path.join(root, 'db', 'migrations', '0002_postgres_canonical_memory.sql'), 'utf8');
    await pool.query(migration);
    await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW()) ON CONFLICT (id) DO NOTHING', [tenantId]);
    await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (tenant_id, id) DO NOTHING', [bankId, tenantId]);

    const health = await fetch(`${baseUrl}/api/v1/health`);
    if (!health.ok) throw new Error(`health failed with HTTP ${health.status}`);
    const idempotencyKey = `oarc-smoke-${Date.now()}`;
    const retain = await fetch(`${baseUrl}/api/v1/memory/retain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': idempotencyKey },
      body: JSON.stringify({ tenantId, bankId, content: 'Ray Sandbox OARC PostgreSQL smoke test is operational.', source: 'postgres-smoke-test', provenance: 'local-live-smoke', idempotencyKey }),
    });
    if (!retain.ok) throw new Error(`retain failed with HTTP ${retain.status}: ${await retain.text()}`);
    const recall = await fetch(`${baseUrl}/api/v1/memory/recall`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId, bankId, query: 'PostgreSQL smoke test', limit: 10 }),
    });
    if (!recall.ok) throw new Error(`recall failed with HTTP ${recall.status}: ${await recall.text()}`);
    const body = await recall.json();
    if (!body.ok || !Array.isArray(body.data?.facts) || body.data.facts.length === 0) throw new Error('recall returned no persisted facts');
    console.log(`PostgreSQL retain/recall smoke test passed for ${tenantId}/${bankId}.`);
  } finally {
    await pool.end();
  }
}
