import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';
import { produceSliceFourEvaluation, sliceFourReport } from '../lib/runtime/evaluation-producer.ts';
import { PostgresRepository } from '../lib/runtime/repositories/postgres.ts';

const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');

const scope = { tenantId: 'slice-4-evaluation-tenant', bankId: 'slice-4-evaluation-bank' };
const projectId = 'slice-4-evaluation';
const generatedAt = process.env.SLICE4_GENERATED_AT?.trim() || '2026-10-10T00:00:00.000Z';
const run = produceSliceFourEvaluation(generatedAt);
const report = sliceFourReport(run);
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });

try {
  await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING', [scope.tenantId]);
  await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING', [scope.bankId, scope.tenantId]);
  const repository = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
  await repository.saveEvaluationRun(scope, projectId, run);
  const persisted = await repository.listEvaluationRuns(scope, projectId, 10);
  if (!persisted.some((candidate) => candidate.id === run.id && candidate.manifest.corpusHash === run.manifest.corpusHash)) throw new Error('persisted evaluation report could not be read back');
  const outputPath = path.resolve('docs', 'benchmarks', 'slice-4-evaluation-report.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, runId: run.id, corpusVersion: run.manifest.corpusVersion, cases: run.metrics?.cases, groundedAccuracy: run.metrics?.groundedAccuracy, citationPrecision: run.metrics?.citationPrecision, unsupportedClaimRate: run.metrics?.unsupportedClaimRate, graphAccuracy: run.metrics?.graphAccuracy, p50LatencyMs: run.metrics?.p50LatencyMs, p95LatencyMs: run.metrics?.p95LatencyMs, totalTokens: run.metrics?.totalTokens, queueDelayMs: run.metrics?.queueDelayMs, costUsd: run.metrics?.costUsd, costPerCorrectAnswerUsd: run.metrics?.costPerCorrectAnswerUsd, persisted: true }, null, 2));
} finally { await pool.end(); }
