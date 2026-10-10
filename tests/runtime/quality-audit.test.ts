import { describe, expect, it } from 'vitest';
import { auditDerivedMemoryProvenance, auditMutationLedger, summarizeSloMeasurements } from '../../lib/runtime/quality-audit';

describe('quality and evidence audits', () => {
  it('reports every derived memory with missing evidence', () => {
    const report = auditDerivedMemoryProvenance([
      { id: 'ok', evidence: [{ reference: 'event-1' }] },
      { id: 'missing', evidence: [] },
    ]);
    expect(report).toEqual({ total: 2, linked: 1, missingRecordIds: ['missing'], coverage: 0.5 });
  });

  it('reports mutations without a durable ledger event', () => {
    const report = auditMutationLedger(
      [{ id: 'event-1', type: 'ProjectMemoryRecorded', payload: { mutationId: 'mutation-1' } }],
      ['mutation-1', 'mutation-2'],
    );
    expect(report).toEqual({ totalMutations: 2, represented: 1, missingMutationIds: ['mutation-2'], coverage: 0.5 });
  });

  it('summarizes measured latency, queue delay, and worker completion results', () => {
    expect(summarizeSloMeasurements({ recall: [10, 20, 30, 40], retain: [5, 10, 15, 20], queueDelay: [2, 4, 8, 16], workerCompletionWithin60s: [true, true, false] })).toMatchObject({
      recall: { p50Ms: 20, p95Ms: 40, p99Ms: 40 },
      retain: { p50Ms: 10, p95Ms: 20, p99Ms: 20 },
      queueDelay: { p50Ms: 4, p95Ms: 16, p99Ms: 16 },
      workerCompletionRate: 2 / 3,
    });
  });
});
