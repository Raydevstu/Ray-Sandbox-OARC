import type { RetrievalTrace } from './retrieval-trace';

export type AdversarialCase = Readonly<{ id: string; query: string; expectedRecordIds: readonly string[]; kind: 'temporal' | 'contradiction' | 'multi-hop' | 'isolation' | 'stale' }>;
export type AdversarialEvaluation = Readonly<{ corpusVersion: 'phase-1-v1'; cases: number; precision: number; multiHopAccuracy: number; isolationFailures: readonly string[]; failedCaseIds: readonly string[] }>;

const adversarialKinds: readonly AdversarialCase['kind'][] = ['temporal', 'contradiction', 'multi-hop', 'isolation', 'stale'];

export const buildPhaseOneAdversarialCorpus = (): readonly AdversarialCase[] => Array.from({ length: 512 }, (_, index) => {
  const kind = adversarialKinds[index % adversarialKinds.length];
  const recordId = `record-${index}`;
  return { id: `phase-1-${String(index).padStart(4, '0')}`, query: `${kind} evidence case ${index}`, expectedRecordIds: [recordId], kind };
});

export const evaluateRetrievalTrace = (cases: readonly AdversarialCase[], traces: ReadonlyMap<string, RetrievalTrace>): AdversarialEvaluation => {
  const results = cases.map((testCase) => ({ testCase, trace: traces.get(testCase.id) }));
  const passed = results.filter(({ testCase, trace }) => Boolean(trace?.items.some((item) => testCase.expectedRecordIds.includes(item.recordId))));
  const multiHop = results.filter(({ testCase }) => testCase.kind === 'multi-hop');
  const multiHopPassed = multiHop.filter(({ testCase, trace }) => Boolean(trace?.items.some((item) => testCase.expectedRecordIds.includes(item.recordId))));
  const isolationFailures = results.filter(({ testCase, trace }) => testCase.kind === 'isolation' && trace?.items.some((item) => !testCase.expectedRecordIds.includes(item.recordId))).map(({ testCase }) => testCase.id);
  return { corpusVersion: 'phase-1-v1', cases: cases.length, precision: passed.length / Math.max(1, cases.length), multiHopAccuracy: multiHopPassed.length / Math.max(1, multiHop.length), isolationFailures, failedCaseIds: results.filter(({ testCase, trace }) => !trace?.items.some((item) => testCase.expectedRecordIds.includes(item.recordId))).map(({ testCase }) => testCase.id) };
};
