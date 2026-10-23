import { describe, expect, it } from 'vitest';
import { createZepReliabilityReport } from '../../lib/runtime/zep-reliability-report';

describe('Zep reliability report', () => {
  it('keeps observed duplicate behavior distinct from passed safety controls', () => {
    const report = createZepReliabilityReport({
      generatedAt: '2026-10-23T00:00:00.000Z',
      duplicate: { status: 'observed', acceptedWrites: 2, contextChars: 40 },
      retry: { status: 'passed', attempts: 2 },
      timeout: { status: 'passed', timeoutMs: 25 },
      concurrency: { status: 'passed', requested: 5, completed: 5 },
      recovery: { status: 'passed', deletedUsers: 5, verifiedDeletedUsers: 5 },
    });

    expect(report.metrics).toEqual({ failures: 0, concurrencyRequested: 5, concurrencyCompleted: 5, cleanupVerified: true });
    expect(report.evidence).toEqual({ IMPLEMENTED: true, TESTED: true, BENCHMARK_VERIFIED: true, LIVE_CONNECTOR_VERIFIED: true, PRODUCTION_VERIFIED: false });
    expect(report.probes.duplicate.status).toBe('observed');
  });
});
