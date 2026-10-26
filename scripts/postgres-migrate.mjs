import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
try {
  const migrationDir = path.join(root, 'db', 'migrations');
  const files = (await readdir(migrationDir)).filter((file) => /^\d+_.*\.sql$/.test(file) && !file.startsWith('0001_')).sort();
  for (const file of files) {
    await pool.query(await readFile(path.join(migrationDir, file), 'utf8'));
    console.log(`PostgreSQL migration applied: ${file}`);
  }
} finally { await pool.end(); }
