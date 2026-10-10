import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/project-memory/benchmark/route';
import { sanitizeBenchmarkExportFilename } from '../../lib/runtime/benchmark-contract';

const modes = ['without-memory', 'local-memory', 'postgres-memory', 'manifest-memory'] as const;
const payload = { id: 'run-1', generatedAt: '2026-10-08T00:00:00.000Z', corpusId: 'golden-v1', modelId: 'test-model', promptVersion: 'p1', evidence: 'replay', cases: modes.map((mode, index) => ({ caseId: `case-${index}`, mode, answerScore: mode === 'without-memory' ? 0 : 1, citationPrecision: mode === 'without-memory' ? 0 : 1, unsupportedClaimRate: 0, latencyMs: index + 1, retrievalLatencyMs: index, queueDelayMs: index, persisted: mode !== 'without-memory', captureStatus: mode === 'without-memory' ? 'uncaptured' : 'captured' })) };

describe('benchmark API', () => {
  it('sanitizes export filenames derived from project scope', () => {
    expect(sanitizeBenchmarkExportFilename('project/with spaces\r\n')).toBe('project_with_spaces_-benchmark.md');
    expect(sanitizeBenchmarkExportFilename('')).toBe('project-benchmark.md');
  });
  it('rejects unauthenticated submissions', async () => {
    const response = await POST(new Request('http://localhost/api/project-memory/benchmark', { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } }));
    expect(response.status).toBe(401);
  });
});
