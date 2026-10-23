import { describe, expect, it } from 'vitest';
import { buildTier15Corpus, produceTier15Benchmark, tier15Report } from '../../lib/runtime/tier15-benchmark';

describe('Tier-1.5 Phase 1/3/5 benchmark', () => {
  it('produces stable corpus and configuration hashes for the same seed and timestamp', () => {
    const first = produceTier15Benchmark({ seed: 'test-seed', generatedAt: '2026-10-23T00:00:00.000Z' });
    const second = produceTier15Benchmark({ seed: 'test-seed', generatedAt: '2026-10-23T00:00:00.000Z' });

    expect(second.manifest).toEqual(first.manifest);
    expect(second.replayHash).toBe(first.replayHash);
    expect(first.manifest.caseCount).toBe(buildTier15Corpus('test-seed').length);
  });

  it('records positive and negative controls for every phase', () => {
    const run = produceTier15Benchmark({ seed: 'controls', generatedAt: '2026-10-23T00:00:00.000Z' });

    for (const phase of ['phase-1-isolation', 'phase-3-temporal', 'phase-5-adversarial']) {
      const cases = run.cases.filter((testCase) => testCase.phase === phase);
      expect(cases.some((testCase) => testCase.control === 'positive')).toBe(true);
      expect(cases.some((testCase) => testCase.control === 'negative')).toBe(true);
      expect(cases.every((testCase) => testCase.scope.tenantId && testCase.scope.bankId && testCase.scope.projectId && testCase.scope.conversationId && testCase.scope.agentId)).toBe(true);
    }
  });

  it('measures zero namespace leakage and rejects the cross-project negative control', () => {
    const run = produceTier15Benchmark({ seed: 'isolation', generatedAt: '2026-10-23T00:00:00.000Z' });
    const isolation = run.cases.filter((testCase) => testCase.phase === 'phase-1-isolation');

    expect(run.metrics.namespaceLeakageRate).toBe(0);
    expect(isolation.find((testCase) => testCase.control === 'negative')?.result).toBe('rejected');
    expect(isolation.find((testCase) => testCase.control === 'positive')?.result).toBe('accepted');
  });

  it('preserves temporal lineage and identifies the active protocol set', () => {
    const run = produceTier15Benchmark({ seed: 'temporal', generatedAt: '2026-10-23T00:00:00.000Z' });
    const temporal = run.cases.filter((testCase) => testCase.phase === 'phase-3-temporal');

    expect(run.metrics.temporalLineageAccuracy).toBe(1);
    expect(temporal.find((testCase) => testCase.control === 'positive')?.answer).toContain('GraphQL -> gRPC -> gRPC + REST');
    expect(temporal.find((testCase) => testCase.control === 'negative')?.result).toBe('rejected');
  });

  it('blocks the adversarial override without creating a policy mutation', () => {
    const run = produceTier15Benchmark({ seed: 'adversarial', generatedAt: '2026-10-23T00:00:00.000Z' });
    const adversarial = run.cases.filter((testCase) => testCase.phase === 'phase-5-adversarial');

    expect(run.metrics.adversarialRejectionRate).toBe(1);
    expect(adversarial.find((testCase) => testCase.control === 'negative')?.result).toBe('rejected');
    expect(run.metrics.canonicalWrites).toBe(0);
  });

  it('exports evidence labels without upgrading local deterministic evidence to production', () => {
    const report = tier15Report(produceTier15Benchmark({ seed: 'labels', generatedAt: '2026-10-23T00:00:00.000Z' }));

    expect(report.evidence).toMatchObject({ IMPLEMENTED: true, TESTED: true, BENCHMARK_VERIFIED: true, PRODUCTION_VERIFIED: false });
    expect(report.metrics.p95LatencyMs).toBeGreaterThanOrEqual(report.metrics.p50LatencyMs);
  });

  it('pins three-project isolation, long-context recall, and temporal reconstruction fixtures', () => {
    const run = produceTier15Benchmark({ seed: 'abc-fixtures', generatedAt: '2026-10-23T00:00:00.000Z' });
    const report = tier15Report(run);

    expect(report.fixtures.isolation.projects).toHaveLength(3);
    expect(report.fixtures.isolation.contaminationAttempt.result).toBe('rejected');
    expect(run.cases.filter((testCase) => testCase.phase === 'phase-1-isolation' && testCase.control === 'positive').map((testCase) => testCase.scope.projectId)).toEqual(expect.arrayContaining(['tier15-abc-fixtures-alpha', 'tier15-abc-fixtures-beta', 'tier15-abc-fixtures-gamma']));
    expect(run.cases.some((testCase) => testCase.query.includes('4,096-token context'))).toBe(true);
    expect(report.fixtures.longContext.precision).toBe(1);
    expect(report.fixtures.longContext.recall).toBe(1);
    expect(report.fixtures.supersession.activeRevision).toBe('gRPC + REST');
    expect(report.configuration).toMatchObject({ promptVersion: expect.any(String), storage: 'postgresql', costCollection: 'deterministic-zero-cost' });
  });
});
