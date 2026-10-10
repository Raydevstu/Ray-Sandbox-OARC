import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');
const output = path.resolve(process.argv[2] ?? path.join('artifacts', `postgres-backup-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')}.dump`));
await mkdir(path.dirname(output), { recursive: true });
await new Promise((resolve, reject) => {
  const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--file', output, databaseUrl], { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with ${code}`)));
});
console.log(JSON.stringify({ ok: true, backup: output }));
