import { describe, expect, it } from 'vitest';
import { summarizeRecallServerTimings } from '../../lib/runtime/recall-timing-report';
import { summarizeRecallLeaseFairness } from '../../lib/runtime/recall-timing-report';

describe('recall timing report', () => {
  it('aggregates redacted connection and query stages without retaining header contents', () => {
    const report = summarizeRecallServerTimings([
      'auth;dur=1, connection;dur=10, query;dur=2, response;dur=3, poolWaiting=4, poolTotal=5',
      'auth;dur=2, connection;dur=30, query;dur=4, response;dur=5, poolWaiting=0, poolTotal=5',
    ]);

    expect(report).toEqual({
      auth: { p50Ms: 1, p95Ms: 2, p99Ms: 2, maxMs: 2 },
      connection: { p50Ms: 10, p95Ms: 30, p99Ms: 30, maxMs: 30 },
      query: { p50Ms: 2, p95Ms: 4, p99Ms: 4, maxMs: 4 },
      response: { p50Ms: 3, p95Ms: 5, p99Ms: 5, maxMs: 5 },
    });
  });

  it('ignores pool counters and malformed stage values', () => {
    expect(summarizeRecallServerTimings(['connection;dur=abc, poolWaiting=4, query;dur=7'])).toEqual({
      query: { p50Ms: 7, p95Ms: 7, p99Ms: 7, maxMs: 7 },
    });
  });

  it('summarizes lease wait ages and detects sequence inversions', () => {
    const summary = summarizeRecallLeaseFairness([
      'connection;dur=4, leaseSequence=2, leaseWait=20, poolWaiting=1',
      'connection;dur=5, leaseSequence=1, leaseWait=10, poolWaiting=1',
      'connection;dur=6, leaseSequence=3, leaseWait=30, poolWaiting=0',
    ]);

    expect(summary.samples).toBe(3);
    expect(summary.sequenceInversions).toBe(1);
    expect(summary.waitMs.p50Ms).toBe(20);
    expect(summary.waitMs.p95Ms).toBe(30);
    expect(summary.maxSequence).toBe(3);
  });
});
