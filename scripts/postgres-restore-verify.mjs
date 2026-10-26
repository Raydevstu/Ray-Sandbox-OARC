import { access } from 'node:fs/promises';
import process from 'node:process';
import { spawn } from 'node:child_process';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: node scripts/postgres-restore-verify.mjs <backup.dump>');
await access(backup);
await new Promise((resolve, reject) => {
  const child = spawn('pg_restore', ['--list', backup], { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', reject); child.on('exit', (code) => {
    if (code !== 0) return reject(new Error(`pg_restore --list exited with ${code}`));
    const required = ['project_memory_records', 'project_events', 'jobs'];
    const missing = required.filter((table) => !output.includes(table));
    if (missing.length) return reject(new Error(`backup is missing required tables: ${missing.join(', ')}`));
    resolve();
  });
});
console.log(JSON.stringify({ ok: true, backup, verified: 'restore manifest', destructiveRestore: false }));
