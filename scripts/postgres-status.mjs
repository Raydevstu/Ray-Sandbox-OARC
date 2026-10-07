import process from 'node:process';
import { Pool } from 'pg';

const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
try {
  const result = await pool.query("SELECT to_regclass('public.tenants') IS NOT NULL AND to_regclass('public.banks') IS NOT NULL AND to_regclass('public.facts') IS NOT NULL AND to_regclass('public.events') IS NOT NULL AS ready");
  const ready = Boolean(result.rows[0]?.ready);
  console.log(JSON.stringify({ database: 'reachable', canonicalSchema: ready ? 'ready' : 'unready' }));
  if (!ready) process.exitCode = 1;
} finally { await pool.end(); }
