import { describe, expect, it } from 'vitest';
import { aggregateEvaluationMetrics, type EvaluationCorrectionProposal, type EvaluationRun, type ReplayComparison, type WorkflowReplay } from '../../lib/runtime/evaluation-contract';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const run: EvaluationRun = { id: 'eval-1', projectId: 'project-1', generatedAt: '2026-10-10T00:00:00.000Z', manifest: { corpusVersion: 'corpus-v1', corpusHash: 'sha256:corpus', caseCount: 1, configVersion: 'config-v1', configHash: 'sha256:config' }, cases: [{ caseId: 'case-1', traceIds: ['trace-1'], grounded: true, citationPrecision: 1, unsupportedClaimRate: 0, graphAccuracy: 1, latencyMs: 40, queueDelayMs: 2, inputTokens: 10, outputTokens: 5, costUsd: 0.01, correct: true }] };
const replay: ReplayComparison = { id: 'replay-eval-1-eval-2', projectId: 'project-1', baselineRunId: 'eval-1', replayRunId: 'eval-2', caseIds: ['case-1'], improved: true, regressions: [], deltas: { groundedAccuracy: 0, citationPrecision: 0, unsupportedClaimRate: 0, graphAccuracy: 0, latencyMs: -5, queueDelayMs: 0, totalTokens: 0, costUsd: 0 } };
const proposal: EvaluationCorrectionProposal = { id: 'proposal-1', projectId: 'project-1', sourceRunId: 'eval-1', caseId: 'case-1', categories: ['unsupported-claim'], traceIds: ['trace-1'], proposedChange: 'require cited evidence', status: 'proposed', createdAt: '2026-10-10T00:00:00.000Z' };
const workflow: WorkflowReplay = { id: 'workflow-1', projectId: 'project-1', sourceRunId: 'eval-1', replayRunId: 'eval-2', correctionProposalId: 'proposal-1', evidenceTraceIds: ['trace-1'], comparison: replay, status: 'complete', createdAt: '2026-10-10T00:00:00.000Z' };

describe('evaluation repository persistence', () => {
  it('stores complete runs with derived metrics and replay comparisons in scope', async () => {
    const repository = new TestRepository('tenant-1');
    await repository.saveEvaluationRun({ tenantId: 'tenant-1', bankId: 'bank-1' }, run.projectId, { ...run, metrics: aggregateEvaluationMetrics(run) });
    await repository.saveReplayComparison({ tenantId: 'tenant-1', bankId: 'bank-1' }, replay);
    await repository.saveEvaluationCorrection({ tenantId: 'tenant-1', bankId: 'bank-1' }, proposal);
    await repository.saveWorkflowReplay({ tenantId: 'tenant-1', bankId: 'bank-1' }, workflow);
    await expect(repository.listEvaluationRuns({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toEqual([{ ...run, metrics: aggregateEvaluationMetrics(run) }]);
    await expect(repository.listReplayComparisons({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toEqual([replay]);
    await expect(repository.listEvaluationCorrections({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toEqual([proposal]);
    await expect(repository.listWorkflowReplays({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toEqual([workflow]);
  });

  it('is idempotent for a complete replay artifact set and preserves source traces on readback', async () => {
    const repository = new TestRepository('tenant-1');
    const failedRun = { ...run, cases: [{ ...run.cases[0], grounded: false, unsupportedClaimRate: 1, traceIds: ['trace-source'] }] };
    const proposalWithTrace = { ...proposal, traceIds: ['trace-source'] };
    const workflowWithTrace = { ...workflow, evidenceTraceIds: ['trace-source'] };
    await repository.saveEvaluationRun({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', failedRun);
    await repository.saveEvaluationRun({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', failedRun);
    await repository.saveEvaluationCorrection({ tenantId: 'tenant-1', bankId: 'bank-1' }, proposalWithTrace);
    await repository.saveEvaluationCorrection({ tenantId: 'tenant-1', bankId: 'bank-1' }, proposalWithTrace);
    await repository.saveWorkflowReplay({ tenantId: 'tenant-1', bankId: 'bank-1' }, workflowWithTrace);
    await repository.saveWorkflowReplay({ tenantId: 'tenant-1', bankId: 'bank-1' }, workflowWithTrace);
    await expect(repository.listEvaluationRuns({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toHaveLength(1);
    await expect(repository.listEvaluationCorrections({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toEqual([proposalWithTrace]);
    await expect(repository.listWorkflowReplays({ tenantId: 'tenant-1', bankId: 'bank-1' }, 'project-1', 10)).resolves.toEqual([workflowWithTrace]);
  });

  it('rejects cross-tenant persistence', async () => {
    const repository = new TestRepository('tenant-1');
    await expect(repository.saveEvaluationRun({ tenantId: 'tenant-2', bankId: 'bank-1' }, run.projectId, run)).rejects.toThrow('scope denied');
  });
});
