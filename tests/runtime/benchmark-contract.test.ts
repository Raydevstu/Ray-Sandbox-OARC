import { describe, expect, it } from 'vitest';
import { benchmarkRunsMarkdown, summarizeBenchmark, validateControlledBenchmark, type ControlledBenchmarkRun } from '../../lib/runtime/benchmark-contract';

const modes = ['without-memory', 'local-memory', 'postgres-memory', 'manifest-memory'] as const;
const run: ControlledBenchmarkRun = { id: 'run-1', generatedAt: '2026-10-08T00:00:00.000Z', corpusId: 'golden-v1', modelId: 'test-model', promptVersion: 'p1', evidence: 'replay', cases: modes.map((mode, index) => ({ caseId: `case-${index}`, mode, answerScore: mode === 'without-memory' ? 0 : 1, citationPrecision: mode === 'without-memory' ? 0 : 1, unsupportedClaimRate: mode === 'without-memory' ? 0.2 : 0, latencyMs: 10 + index, retrievalLatencyMs: index, queueDelayMs: index, persisted: mode !== 'without-memory', captureStatus: mode === 'without-memory' ? 'uncaptured' : 'captured' })) };

describe('controlled benchmark contract', () => {
  it('requires all four modes and summarizes them', () => {
    validateControlledBenchmark(run);
    expect(summarizeBenchmark(run)['postgres-memory']).toMatchObject({ cases: 1, answerScore: 1 });
  });
  it('rejects incomplete mode coverage and false capture claims', () => {
    expect(() => validateControlledBenchmark({ ...run, cases: run.cases.slice(1) })).toThrow('mode missing');
    expect(() => validateControlledBenchmark({ ...run, evidence: 'live-codex', cases: run.cases.map((item) => item.mode === 'manifest-memory' ? { ...item, captureStatus: 'uncaptured' } : item) })).toThrow('uncaptured');
  });
  it('renders a scoped markdown export with explicit mode metrics', () => {
    const markdown = benchmarkRunsMarkdown('project-1', [run]);
    expect(markdown).toContain('Project: project-1');
    expect(markdown).toContain('| without-memory |');
    expect(markdown).toContain('| manifest-memory |');
  });
});
