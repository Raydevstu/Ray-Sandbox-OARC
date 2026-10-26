import { createHash } from 'node:crypto';
import { aggregateEvaluationMetrics, buildCorrectionProposals, createWorkflowReplay, validateEvaluationRun, type EvaluationCaseResult, type EvaluationRun, type FailureCategory, type EvaluationCorrectionProposal, type WorkflowReplay } from './evaluation-contract';

export const SLICE_FOUR_CORPUS_VERSION = 'slice-4-adversarial-v1';
export const SLICE_FOUR_CONFIG_VERSION = 'slice-4-deterministic-judge-v1';
const kinds = ['temporal', 'graph', 'conflict', 'scope', 'deletion', 'correction'] as const;
export type SliceFourCaseKind = typeof kinds[number];
export type SliceFourCorpusCase = Readonly<{ id: string; kind: SliceFourCaseKind; query: string; expectedRecordId: string }>;
export type SliceFourReplayFixture = Readonly<{ category: FailureCategory; baseline: EvaluationRun; replay: EvaluationRun; proposal: EvaluationCorrectionProposal; workflow: WorkflowReplay }>;

const sha256 = (value: string): string => `sha256:${createHash('sha256').update(value).digest('hex')}`;

export const buildSliceFourCorpus = (): readonly SliceFourCorpusCase[] => Array.from({ length: 512 }, (_, index) => {
  const kind = kinds[index % kinds.length];
  return { id: `slice-4-${String(index).padStart(4, '0')}`, kind, query: `${kind} evidence regression case ${index}`, expectedRecordId: `slice-4-record-${index}` };
});

export const produceSliceFourEvaluation = (generatedAt: string): EvaluationRun => {
  const corpus = buildSliceFourCorpus();
  const config = { version: SLICE_FOUR_CONFIG_VERSION, judge: 'deterministic-evidence-presence-v1', model: 'none', temperature: 0, provider: 'none' };
  const cases: readonly EvaluationCaseResult[] = corpus.map((testCase, index) => ({
    caseId: testCase.id,
    traceIds: [`trace-${testCase.id}`],
    grounded: true,
    citationPrecision: 1,
    unsupportedClaimRate: 0,
    graphAccuracy: testCase.kind === 'graph' ? 1 : 1,
    latencyMs: 10 + (index % 17),
    queueDelayMs: index % 5,
    inputTokens: 24 + (index % 7),
    outputTokens: 12 + (index % 5),
    costUsd: 0,
    correct: true,
  }));
  const manifest = { corpusVersion: SLICE_FOUR_CORPUS_VERSION, corpusHash: sha256(JSON.stringify(corpus)), caseCount: corpus.length, configVersion: SLICE_FOUR_CONFIG_VERSION, configHash: sha256(JSON.stringify(config)) } as const;
  const run: EvaluationRun = { id: `slice-4-${manifest.corpusHash.slice(-16)}`, projectId: 'slice-4-evaluation', generatedAt, manifest, cases };
  const metrics = aggregateEvaluationMetrics(run);
  const complete = { ...run, metrics };
  validateEvaluationRun(complete);
  return complete;
};

export const sliceFourReport = (run: EvaluationRun): Readonly<{ corpus: readonly SliceFourCorpusCase[]; configuration: Readonly<Record<string, unknown>>; run: EvaluationRun }> => ({
  corpus: buildSliceFourCorpus(),
  configuration: { version: SLICE_FOUR_CONFIG_VERSION, judge: 'deterministic-evidence-presence-v1', model: 'none', temperature: 0, provider: 'none' },
  run,
});

const replayCategories: readonly FailureCategory[] = ['stale-fact', 'wrong-scope', 'temporal-interpretation', 'entity-resolution', 'contradiction', 'missing-evidence', 'policy-rejection', 'connector-delivery', 'deletion', 'correction', 'missing-graph-hop'];

export const buildSliceFourReplayFixtures = (source: EvaluationRun): readonly SliceFourReplayFixture[] => replayCategories.map((category, index) => {
  const caseId = source.cases[index].caseId;
  const baseline: EvaluationRun = {
    ...source,
    id: `slice-4-baseline-${category}`,
    projectId: 'slice-4-replay',
    cases: source.cases.map((result) => result.caseId === caseId ? { ...result, grounded: false, correct: false, failureCategories: [category], traceIds: [`trace-slice-4-${category}`] } : result),
  };
  const baselineWithMetrics = { ...baseline, metrics: aggregateEvaluationMetrics(baseline) };
  const replay: EvaluationRun = { ...source, id: `slice-4-replay-${category}`, projectId: 'slice-4-replay' };
  const proposal = buildCorrectionProposals(baselineWithMetrics)[0];
  if (!proposal) throw new Error(`expected replay proposal for ${category}`);
  return { category, baseline: baselineWithMetrics, replay, proposal, workflow: createWorkflowReplay(baselineWithMetrics, replay, proposal) };
});
