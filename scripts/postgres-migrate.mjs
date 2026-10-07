import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
try {
  const sql = await readFile(path.join(root, 'db', 'migrations', '0002_postgres_canonical_memory.sql'), 'utf8');
  await pool.query(sql);
  console.log('PostgreSQL canonical-memory migration applied.');
} finally { await pool.end(); }
