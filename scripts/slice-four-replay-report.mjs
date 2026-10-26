import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';
import { buildSliceFourReplayFixtures, produceSliceFourEvaluation } from '../lib/runtime/evaluation-producer.ts';
import { PostgresRepository } from '../lib/runtime/repositories/postgres.ts';

const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');

const scope = { tenantId: 'slice-4-replay-tenant', bankId: 'slice-4-replay-bank' };
const projectId = 'slice-4-replay';
const generatedAt = process.env.SLICE4_GENERATED_AT?.trim() || '2026-10-10T00:00:00.000Z';
const source = produceSliceFourEvaluation(generatedAt);
const fixtures = buildSliceFourReplayFixtures(source);
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });

try {
  await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING', [scope.tenantId]);
  await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING', [scope.bankId, scope.tenantId]);
  const repository = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
  for (const fixture of fixtures) {
    await repository.saveEvaluationRun(scope, projectId, fixture.baseline);
    await repository.saveEvaluationRun(scope, projectId, fixture.replay);
    await repository.saveEvaluationCorrection(scope, fixture.proposal);
    await repository.saveReplayComparison(scope, fixture.workflow.comparison);
    await repository.saveWorkflowReplay(scope, fixture.workflow);
  }
  const persistedRuns = await repository.listEvaluationRuns(scope, projectId, 100);
  const persistedProposals = await repository.listEvaluationCorrections(scope, projectId, 100);
  const persistedComparisons = await repository.listReplayComparisons(scope, projectId, 100);
  const persistedWorkflows = await repository.listWorkflowReplays(scope, projectId, 100);
  if (persistedRuns.length < fixtures.length * 2 || persistedProposals.length < fixtures.length || persistedComparisons.length < fixtures.length || persistedWorkflows.length < fixtures.length) throw new Error(`complete replay artifact set could not be read back: runs=${persistedRuns.length}, proposals=${persistedProposals.length}, comparisons=${persistedComparisons.length}, workflows=${persistedWorkflows.length}`);
  for (const fixture of fixtures) {
    const persistedBaseline = persistedRuns.find((candidate) => candidate.id === fixture.baseline.id);
    const persistedProposal = persistedProposals.find((candidate) => candidate.id === fixture.proposal.id);
    const persistedWorkflow = persistedWorkflows.find((candidate) => candidate.id === fixture.workflow.id);
    if (!persistedBaseline?.cases.some((candidate) => candidate.traceIds.includes(fixture.proposal.traceIds[0]))) throw new Error(`source trace not readable for ${fixture.category}`);
    if (!persistedProposal?.traceIds.includes(fixture.proposal.traceIds[0]) || !persistedWorkflow?.evidenceTraceIds.includes(fixture.proposal.traceIds[0])) throw new Error(`linked trace not readable for ${fixture.category}`);
  }
  const report = { source, fixtures };
  const outputPath = path.resolve('docs', 'benchmarks', 'slice-4-replay-report.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, fixtures: fixtures.length, categories: fixtures.map((fixture) => fixture.category), persistedRuns: persistedRuns.length, persistedProposals: persistedProposals.length, persistedComparisons: persistedComparisons.length, persistedWorkflows: persistedWorkflows.length, allImproved: fixtures.every((fixture) => fixture.workflow.comparison.improved), persisted: true }, null, 2));
} finally { await pool.end(); }
