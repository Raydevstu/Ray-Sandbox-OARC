import { describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgresRepository } from '../../lib/runtime/repositories/postgres';
import { retainMemory } from '../../lib/runtime/retention';
import { recallMemory } from '../../lib/runtime/retrieval';
import { updateMemory } from '../../lib/runtime/memory/service';
import { createWorkflowReplay, type EvaluationRun } from '../../lib/runtime/evaluation-contract';

const url = process.env.APEX_DATABASE_URL;
const suite = url ? describe : describe.skip;

const run = (id: string, projectId: string, correct: boolean): EvaluationRun => ({
  id,
  projectId,
  generatedAt: '2026-10-10T00:00:00.000Z',
  manifest: { corpusVersion: 'diagnosis-v1', corpusHash: 'corpus-hash', caseCount: 1, configVersion: 'config-v1', configHash: 'config-hash' },
  cases: [{ caseId: 'case-1', traceIds: ['trace-diagnosis'], grounded: correct, citationPrecision: correct ? 1 : 0.5, unsupportedClaimRate: correct ? 0 : 0.5, graphAccuracy: 1, latencyMs: 10, queueDelayMs: 0, inputTokens: 10, outputTokens: 5, costUsd: 0, correct }],
});

suite('PostgreSQL developer diagnosis workflow', () => {
  it('persists one project-scoped retain-to-evaluate workflow and excludes another project', async () => {
    const pool = new Pool({ connectionString: url });
    const scope = { tenantId: `diagnosis-${Date.now()}`, bankId: 'developer-bank' };
    const projectId = 'project-a';
    const otherProjectId = 'project-b';
    const repository = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
    try {
      await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW())', [scope.tenantId]);
      await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW())', [scope.bankId, scope.tenantId]);
      const retained = await retainMemory({ ...scope, projectId, content: 'Project A keeps diagnosis evidence durable.', source: 'diagnosis-test', provenance: 'local-postgres', idempotencyKey: `retain-${scope.tenantId}` }, repository);
      await retainMemory({ ...scope, projectId: otherProjectId, content: 'Project B must remain isolated.', source: 'diagnosis-test', provenance: 'local-postgres', idempotencyKey: `retain-other-${scope.tenantId}` }, repository);
      const recalled = await recallMemory({ ...scope, projectId, query: 'diagnosis evidence' }, repository);
      const corrected = await updateMemory({ ...scope, projectId }, retained.fact.id, 'Project A diagnosis evidence was corrected.', repository);
      const baseline = run(`baseline-${scope.tenantId}`, projectId, false);
      const replay = run(`replay-${scope.tenantId}`, projectId, true);
      const proposal = { id: `proposal-${scope.tenantId}`, projectId, sourceRunId: baseline.id, caseId: 'case-1', categories: ['correction'] as const, traceIds: ['trace-diagnosis'], proposedChange: 'apply reviewed correction', status: 'approved' as const, createdAt: baseline.generatedAt };
      const workflow = createWorkflowReplay(baseline, replay, proposal);
      await repository.saveEvaluationRun(scope, projectId, baseline);
      await repository.saveEvaluationRun(scope, projectId, replay);
      await repository.saveEvaluationCorrection(scope, proposal);
      await repository.saveReplayComparison(scope, workflow.comparison);
      await repository.saveWorkflowReplay(scope, workflow);

      const fresh = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
      expect(recalled.facts.map((fact) => fact.projectId)).toEqual([projectId]);
      expect((await fresh.findFacts({ ...scope, projectId })).every((fact) => fact.projectId === projectId)).toBe(true);
      expect((await fresh.findFacts({ ...scope, projectId: otherProjectId })).map((fact) => fact.id)).not.toContain(retained.fact.id);
      expect(corrected.projectId).toBe(projectId);
      await expect(fresh.listEvaluationRuns(scope, projectId, 10)).resolves.toHaveLength(2);
      await expect(fresh.listEvaluationCorrections(scope, projectId, 10)).resolves.toEqual([proposal]);
      await expect(fresh.listWorkflowReplays(scope, projectId, 10)).resolves.toEqual([workflow]);
    } finally {
      await pool.query('DELETE FROM project_workflow_replays WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM project_replay_comparisons WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM project_evaluation_corrections WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM project_evaluation_runs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM outbox WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM events WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM fact_evidence WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM facts WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM evidence WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM banks WHERE tenant_id = $1', [scope.tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = $1', [scope.tenantId]);
      await pool.end();
    }
  }, 15_000);
});
