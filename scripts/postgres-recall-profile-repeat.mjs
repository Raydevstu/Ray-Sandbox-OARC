import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { summarizeRepeatedRecallProfiles } from '../lib/runtime/recall-profile-repeat.ts';

const runs = Math.max(1, Number(process.env.SLO_PROFILE_RUNS ?? 5));
const outputPath = path.resolve(process.env.SLO_REPORT_PATH?.trim() || 'docs/benchmarks/tier15-recall-repeat-100.json');
const reportDirectory = path.join(path.dirname(outputPath), `${path.basename(outputPath, '.json')}-runs`);
await mkdir(reportDirectory, { recursive: true });

const runProfile = (index) => new Promise((resolve, reject) => {
  const reportPath = path.join(reportDirectory, `run-${String(index + 1).padStart(2, '0')}.json`);
  const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/postgres-recall-profile.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, SLO_CONCURRENCY: '100', SLO_REPORT_PATH: reportPath },
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('exit', async (code) => {
    try {
      const report = JSON.parse(await readFile(reportPath, 'utf8'));
      resolve({ code: code ?? 1, reportPath, report });
    } catch (error) { reject(error); }
  });
});

const results = [];
for (let index = 0; index < runs; index += 1) results.push(await runProfile(index));
const summary = summarizeRepeatedRecallProfiles(results.map(({ report }) => report));
const report = { generatedAt: new Date().toISOString(), concurrency: 100, runs: results.map(({ code, reportPath, report }) => ({ code, reportPath, request: report.request, directDatabase: report.directDatabase })), summary, leaseFairnessByRun: results.map(({ report }) => report.request.leaseFairness ?? null) };
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, ...summary }, null, 2));
if (!summary.sloPassed) process.exitCode = 1;
