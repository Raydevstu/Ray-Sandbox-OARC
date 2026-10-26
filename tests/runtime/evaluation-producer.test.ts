import { describe, expect, it } from 'vitest';
import { buildSliceFourCorpus, buildSliceFourReplayFixtures, produceSliceFourEvaluation } from '../../lib/runtime/evaluation-producer';

describe('Slice 4 evaluation producer', () => {
  it('builds a deterministic 500-plus corpus across all required failure classes', () => {
    const first = buildSliceFourCorpus();
    const second = buildSliceFourCorpus();
    expect(first).toHaveLength(512);
    expect(first).toEqual(second);
    expect(new Set(first.map((item) => item.kind))).toEqual(new Set(['temporal', 'graph', 'conflict', 'scope', 'deletion', 'correction']));
  });

  it('produces a reproducible versioned run with absolute metrics and hashes', () => {
    const first = produceSliceFourEvaluation('2026-10-10T00:00:00.000Z');
    const second = produceSliceFourEvaluation('2026-10-10T00:00:00.000Z');
    expect(first).toEqual(second);
    expect(first.manifest.caseCount).toBe(512);
    expect(first.manifest.corpusHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.manifest.configHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.metrics).toMatchObject({ cases: 512, correctCases: 512, groundedAccuracy: 1, citationPrecision: 1, unsupportedClaimRate: 0, graphAccuracy: 1 });
  });

  it('builds durable replay fixtures for every required replay scenario', () => {
    const fixtures = buildSliceFourReplayFixtures(produceSliceFourEvaluation('2026-10-10T00:00:00.000Z'));
    expect(fixtures.map((fixture) => fixture.category)).toEqual([
      'stale-fact', 'wrong-scope', 'temporal-interpretation', 'entity-resolution', 'contradiction',
      'missing-evidence', 'policy-rejection', 'connector-delivery', 'deletion', 'correction', 'missing-graph-hop',
    ]);
    expect(fixtures.every((fixture) => fixture.proposal.traceIds.length > 0 && fixture.workflow.evidenceTraceIds.length > 0 && fixture.workflow.comparison.improved)).toBe(true);
  });
});
