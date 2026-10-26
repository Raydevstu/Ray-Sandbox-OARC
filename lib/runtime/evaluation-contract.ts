export const FAILURE_CATEGORIES = ['missing-evidence', 'wrong-scope', 'stale-fact', 'temporal-interpretation', 'entity-resolution', 'missing-graph-hop', 'contradiction', 'unsupported-claim', 'extraction-failure', 'policy-rejection', 'connector-delivery', 'deletion', 'correction'] as const;
export type FailureCategory = typeof FAILURE_CATEGORIES[number];

export type EvaluationManifest = Readonly<{
  corpusVersion: string;
  corpusHash: string;
  caseCount: number;
  configVersion: string;
  configHash: string;
}>;

export type EvaluationCaseResult = Readonly<{
  caseId: string;
  traceIds: readonly string[];
  grounded: boolean;
  citationPrecision: number;
  unsupportedClaimRate: number;
  graphAccuracy: number;
  latencyMs: number;
  queueDelayMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  correct: boolean;
  failureCategories?: readonly FailureCategory[];
}>;

export type EvaluationMetrics = Readonly<{
  cases: number;
  correctCases: number;
  groundedAccuracy: number;
  citationPrecision: number;
  unsupportedClaimRate: number;
  graphAccuracy: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  queueDelayMs: number;
  costUsd: number;
  costPerCorrectAnswerUsd: number;
}>;

export type EvaluationRun = Readonly<{
  id: string;
  projectId: string;
  generatedAt: string;
  manifest: EvaluationManifest;
  cases: readonly EvaluationCaseResult[];
  metrics?: EvaluationMetrics;
}>;

export type FailureClassification = Readonly<{ caseId: string; categories: readonly FailureCategory[]; traceIds: readonly string[] }>;
export type EvaluationCorrectionProposal = Readonly<{ id: string; projectId: string; sourceRunId: string; caseId: string; categories: readonly FailureCategory[]; traceIds: readonly string[]; proposedChange: string; status: 'proposed' | 'approved' | 'rejected'; createdAt: string }>;
export type ReplayComparison = Readonly<{
  id: string;
  projectId: string;
  baselineRunId: string;
  replayRunId: string;
  caseIds: readonly string[];
  improved: boolean;
  regressions: readonly string[];
  deltas: Readonly<Partial<Record<'groundedAccuracy' | 'citationPrecision' | 'unsupportedClaimRate' | 'graphAccuracy' | 'latencyMs' | 'queueDelayMs' | 'totalTokens' | 'costUsd', number>>>;
}>;
export type WorkflowReplay = Readonly<{ id: string; projectId: string; sourceRunId: string; replayRunId: string; correctionProposalId: string; evidenceTraceIds: readonly string[]; comparison: ReplayComparison; status: 'queued' | 'running' | 'complete' | 'failed'; createdAt: string }>;

const rate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
const nonNegative = (value: number): boolean => Number.isFinite(value) && value >= 0;
const average = (values: readonly number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const percentile = (values: readonly number[], fraction: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

export function validateEvaluationRun(run: EvaluationRun): void {
  if (!run.id.trim() || !run.projectId.trim() || !run.generatedAt.trim()) throw new Error('evaluation identity is incomplete');
  if (!run.manifest.corpusVersion.trim() || !run.manifest.corpusHash.trim()) throw new Error('corpusHash is required');
  if (!run.manifest.configVersion.trim() || !run.manifest.configHash.trim()) throw new Error('configHash is required');
  if (!Number.isInteger(run.manifest.caseCount) || run.manifest.caseCount !== run.cases.length) throw new Error('manifest caseCount must match cases');
  if (!run.cases.length) throw new Error('evaluation must contain cases');
  for (const result of run.cases) {
    if (!result.caseId.trim() || result.traceIds.some((traceId) => !traceId.trim())) throw new Error('evaluation case identity is incomplete');
    for (const [name, value] of [['citationPrecision', result.citationPrecision], ['unsupportedClaimRate', result.unsupportedClaimRate], ['graphAccuracy', result.graphAccuracy]] as const) if (!rate(value)) throw new Error(`${name} must be between 0 and 1`);
    for (const [name, value] of [['latencyMs', result.latencyMs], ['queueDelayMs', result.queueDelayMs], ['inputTokens', result.inputTokens], ['outputTokens', result.outputTokens], ['costUsd', result.costUsd]] as const) if (!nonNegative(value)) throw new Error(`${name} must be non-negative`);
    if (result.failureCategories?.some((category) => !FAILURE_CATEGORIES.includes(category))) throw new Error('failure category is invalid');
  }
  if (run.metrics) {
    if (run.metrics.cases !== run.cases.length) throw new Error('metrics cases must match cases');
    for (const [name, value] of [['groundedAccuracy', run.metrics.groundedAccuracy], ['citationPrecision', run.metrics.citationPrecision], ['unsupportedClaimRate', run.metrics.unsupportedClaimRate], ['graphAccuracy', run.metrics.graphAccuracy]] as const) if (!rate(value)) throw new Error(`${name} must be between 0 and 1`);
  }
}

export function aggregateEvaluationMetrics(run: EvaluationRun): EvaluationMetrics {
  validateEvaluationRun({ ...run, metrics: undefined });
  const cases = run.cases;
  const correctCases = cases.filter((result) => result.correct).length;
  const costUsd = cases.reduce((sum, result) => sum + result.costUsd, 0);
  return {
    cases: cases.length,
    correctCases,
    groundedAccuracy: cases.filter((result) => result.grounded).length / cases.length,
    citationPrecision: average(cases.map((result) => result.citationPrecision)),
    unsupportedClaimRate: average(cases.map((result) => result.unsupportedClaimRate)),
    graphAccuracy: average(cases.map((result) => result.graphAccuracy)),
    p50LatencyMs: percentile(cases.map((result) => result.latencyMs), 0.5),
    p95LatencyMs: percentile(cases.map((result) => result.latencyMs), 0.95),
    totalTokens: cases.reduce((sum, result) => sum + result.inputTokens + result.outputTokens, 0),
    queueDelayMs: average(cases.map((result) => result.queueDelayMs)),
    costUsd,
    costPerCorrectAnswerUsd: correctCases ? costUsd / correctCases : 0,
  };
}

export function classifyEvaluationFailure(result: EvaluationCaseResult): FailureClassification {
  const categories: FailureCategory[] = result.failureCategories ? [...result.failureCategories] : [];
  if (categories.length) return { caseId: result.caseId, categories: [...new Set(categories)], traceIds: [...result.traceIds] };
  if (!result.grounded || result.unsupportedClaimRate > 0) categories.push('unsupported-claim');
  if (result.graphAccuracy < 1) categories.push('missing-graph-hop');
  return { caseId: result.caseId, categories, traceIds: [...result.traceIds] };
}

export function buildCorrectionProposals(run: EvaluationRun): readonly EvaluationCorrectionProposal[] {
  validateEvaluationRun(run);
  return run.cases.map((result) => {
    const failure = classifyEvaluationFailure(result);
    if (!failure.categories.length) return undefined;
    return { id: `proposal-${run.id}-${result.caseId}`, projectId: run.projectId, sourceRunId: run.id, caseId: result.caseId, categories: failure.categories, traceIds: failure.traceIds, proposedChange: `replay ${failure.categories.join(', ')} with preserved evidence`, status: 'proposed', createdAt: run.generatedAt };
  }).filter((proposal): proposal is EvaluationCorrectionProposal => Boolean(proposal));
}

export function compareEvaluationRuns(baseline: EvaluationRun, replay: EvaluationRun): ReplayComparison {
  validateEvaluationRun(baseline);
  validateEvaluationRun(replay);
  if (baseline.projectId !== replay.projectId) throw new Error('evaluation project scope mismatch');
  const before = aggregateEvaluationMetrics(baseline);
  const after = aggregateEvaluationMetrics(replay);
  const deltas = {
    groundedAccuracy: after.groundedAccuracy - before.groundedAccuracy,
    citationPrecision: after.citationPrecision - before.citationPrecision,
    unsupportedClaimRate: after.unsupportedClaimRate - before.unsupportedClaimRate,
    graphAccuracy: after.graphAccuracy - before.graphAccuracy,
    latencyMs: after.p50LatencyMs - before.p50LatencyMs,
    queueDelayMs: after.queueDelayMs - before.queueDelayMs,
    totalTokens: after.totalTokens - before.totalTokens,
    costUsd: after.costUsd - before.costUsd,
  };
  const regressions = [
    deltas.groundedAccuracy < 0 && 'groundedAccuracy', deltas.citationPrecision < 0 && 'citationPrecision', deltas.unsupportedClaimRate > 0 && 'unsupportedClaimRate', deltas.graphAccuracy < 0 && 'graphAccuracy',
    deltas.latencyMs > 0 && 'latencyMs', deltas.queueDelayMs > 0 && 'queueDelayMs', deltas.totalTokens > 0 && 'totalTokens', deltas.costUsd > 0 && 'costUsd',
  ].filter((value): value is string => Boolean(value));
  return { id: `replay-${baseline.id}-${replay.id}`, projectId: replay.projectId, baselineRunId: baseline.id, replayRunId: replay.id, caseIds: replay.cases.map((result) => result.caseId), improved: regressions.length === 0 && Object.values(deltas).some((value) => value !== 0), regressions, deltas };
}

export function createWorkflowReplay(baseline: EvaluationRun, replay: EvaluationRun, proposal: EvaluationCorrectionProposal): WorkflowReplay {
  validateEvaluationRun(baseline);
  validateEvaluationRun(replay);
  if (proposal.projectId !== baseline.projectId || proposal.sourceRunId !== baseline.id) throw new Error('correction proposal scope mismatch');
  if (!proposal.traceIds.length) throw new Error('correction proposal requires evidence traces');
  const comparison = compareEvaluationRuns(baseline, replay);
  return { id: `workflow-${proposal.id}-${replay.id}`, projectId: replay.projectId, sourceRunId: baseline.id, replayRunId: replay.id, correctionProposalId: proposal.id, evidenceTraceIds: [...proposal.traceIds], comparison, status: 'complete', createdAt: replay.generatedAt };
}
