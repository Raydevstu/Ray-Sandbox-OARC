import { describe, expect, it } from 'vitest';
import { aggregateEvaluationMetrics, buildCorrectionProposals, classifyEvaluationFailure, compareEvaluationRuns, createWorkflowReplay, validateEvaluationRun, type EvaluationRun } from '../../lib/runtime/evaluation-contract';

const run = (overrides: Partial<EvaluationRun> = {}): EvaluationRun => ({
  id: 'eval-1',
  projectId: 'project-1',
  generatedAt: '2026-10-10T00:00:00.000Z',
  manifest: { corpusVersion: 'adversarial-v2', corpusHash: 'sha256:corpus', caseCount: 1, configVersion: 'judge-v1', configHash: 'sha256:config' },
  cases: [{ caseId: 'case-1', traceIds: ['trace-1'], grounded: true, citationPrecision: 1, unsupportedClaimRate: 0, graphAccuracy: 1, latencyMs: 100, queueDelayMs: 10, inputTokens: 20, outputTokens: 10, costUsd: 0.02, correct: true }],
  ...overrides,
});

describe('closed-loop evaluation contract', () => {
  it('validates reproducibility identity and aggregates absolute quality and cost metrics', () => {
    const evaluation = run();
    validateEvaluationRun(evaluation);
    expect(aggregateEvaluationMetrics(evaluation)).toMatchObject({ cases: 1, groundedAccuracy: 1, citationPrecision: 1, unsupportedClaimRate: 0, graphAccuracy: 1, p50LatencyMs: 100, p95LatencyMs: 100, totalTokens: 30, queueDelayMs: 10, costUsd: 0.02, costPerCorrectAnswerUsd: 0.02 });
    expect(() => validateEvaluationRun(run({ manifest: { ...evaluation.manifest, corpusHash: '' } }))).toThrow('corpusHash');
  });

  it('classifies failed cases and preserves trace references', () => {
    const result = classifyEvaluationFailure({ ...run().cases[0], grounded: false, citationPrecision: 0, unsupportedClaimRate: 1, graphAccuracy: 0, traceIds: ['trace-failed'] });
    expect(result).toEqual({ caseId: 'case-1', categories: ['unsupported-claim', 'missing-graph-hop'], traceIds: ['trace-failed'] });
  });

  it('classifies every governed replay failure type from explicit case metadata', () => {
    const categories = ['stale-fact', 'wrong-scope', 'temporal-interpretation', 'entity-resolution', 'contradiction', 'missing-evidence', 'policy-rejection', 'connector-delivery', 'deletion', 'correction', 'missing-graph-hop'] as const;
    const result = classifyEvaluationFailure({ ...run().cases[0], failureCategories: categories, traceIds: ['trace-governed-failure'] });
    expect(result).toEqual({ caseId: 'case-1', categories, traceIds: ['trace-governed-failure'] });
  });

  it('rejects replay improvement when any safety or quality metric regresses', () => {
    const comparison = compareEvaluationRuns(run(), run({ id: 'eval-2', cases: [{ ...run().cases[0], latencyMs: 90, unsupportedClaimRate: 0.2 }] }));
    expect(comparison.improved).toBe(false);
    expect(comparison.regressions).toContain('unsupportedClaimRate');
    expect(comparison.deltas.latencyMs).toBe(-10);
  });

  it('creates durable correction proposals and a replay bound to the original trace', () => {
    const failed = run({ cases: [{ ...run().cases[0], grounded: false, unsupportedClaimRate: 1, traceIds: ['trace-original'] }] });
    const proposals = buildCorrectionProposals(failed);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ sourceRunId: 'eval-1', caseId: 'case-1', traceIds: ['trace-original'], status: 'proposed' });
    const replayRun = run({ id: 'eval-2' });
    expect(createWorkflowReplay(failed, replayRun, proposals[0])).toMatchObject({ sourceRunId: 'eval-1', replayRunId: 'eval-2', correctionProposalId: proposals[0].id, evidenceTraceIds: ['trace-original'], comparison: { improved: true } });
  });

  it('rejects missing traces and mismatched source runs before replay creation', () => {
    const failed = run({ cases: [{ ...run().cases[0], grounded: false, unsupportedClaimRate: 1 }] });
    const replayRun = run({ id: 'eval-2' });
    const proposal = buildCorrectionProposals(failed)[0];
    expect(proposal).toBeDefined();
    expect(() => createWorkflowReplay(failed, replayRun, { ...proposal!, traceIds: [] })).toThrow('evidence traces');
    expect(() => createWorkflowReplay(failed, replayRun, { ...proposal!, sourceRunId: 'other-run' })).toThrow('scope mismatch');
    expect(() => createWorkflowReplay(failed, replayRun, { ...proposal!, projectId: 'other-project' })).toThrow('scope mismatch');
  });

  it.each([
    ['groundedAccuracy', { grounded: false }],
    ['citationPrecision', { citationPrecision: 0 }],
    ['graphAccuracy', { graphAccuracy: 0 }],
    ['latencyMs', { latencyMs: 200 }],
    ['queueDelayMs', { queueDelayMs: 200 }],
    ['totalTokens', { inputTokens: 200 }],
    ['costUsd', { costUsd: 2 }],
  ] as const)('rejects replay regression in %s', (metric, regression) => {
    const comparison = compareEvaluationRuns(run(), run({ id: `eval-${metric}`, cases: [{ ...run().cases[0], ...regression }] }));
    expect(comparison.improved).toBe(false);
    expect(comparison.regressions).toContain(metric);
  });

  it('rejects an unsupported explicit failure category', () => {
    expect(() => validateEvaluationRun(run({ cases: [{ ...run().cases[0], failureCategories: ['not-a-category' as never] }] }))).toThrow('failure category');
  });
});
