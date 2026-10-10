import { describe, expect, it } from 'vitest';
import { buildPhaseOneAdversarialCorpus, evaluateRetrievalTrace, type AdversarialCase } from '../../lib/runtime/adversarial-evaluation';
import type { RetrievalTrace } from '../../lib/runtime/retrieval-trace';

const trace = (items: RetrievalTrace['items']): RetrievalTrace => ({ traceId: 't', query: 'q', items, gaps: [] });
const cases: readonly AdversarialCase[] = [
  { id: 'exact', query: 'q', expectedRecordIds: ['r1'], kind: 'temporal' },
  { id: 'isolated', query: 'q', expectedRecordIds: ['r2'], kind: 'isolation' },
];

describe('adversarial retrieval evaluation', () => {
  it('reports corpus version, precision, and failed case IDs', () => {
    const result = evaluateRetrievalTrace(cases, new Map([
      ['exact', trace([{ recordId: 'r1', score: 1, confidence: 0.9, evidenceReferences: ['e1'], rationale: 'match', createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z', status: 'verified', source: { platform: 'test', timestamp: '2026-10-10T00:00:00.000Z' } }])],
      ['isolated', trace([])],
    ]));
    expect(result).toMatchObject({ corpusVersion: 'phase-1-v1', cases: 2, precision: 0.5, failedCaseIds: ['isolated'] });
  });

  it('builds the deterministic full adversarial corpus with at least 500 cases', () => {
    const first = buildPhaseOneAdversarialCorpus();
    const second = buildPhaseOneAdversarialCorpus();
    expect(first).toHaveLength(512);
    expect(first).toEqual(second);
    expect(new Set(first.map((testCase) => testCase.kind))).toEqual(new Set(['temporal', 'contradiction', 'multi-hop', 'isolation', 'stale']));
  });
});
