import { describe, expect, it } from 'vitest';
import { summarizeRepeatedRecallProfiles } from '../../lib/runtime/recall-profile-repeat';

describe('repeated recall profile summary', () => {
  it('keeps individual p95 values and passes only when every run clears the SLO', () => {
    const summary = summarizeRepeatedRecallProfiles([
      { request: { failures: 0, p95Ms: 420 } },
      { request: { failures: 0, p95Ms: 480 } },
      { request: { failures: 0, p95Ms: 499 } },
    ]);

    expect(summary.runP95Ms).toEqual([420, 480, 499]);
    expect(summary.p95OfRunP95Ms).toBe(499);
    expect(summary.sloPassed).toBe(true);
  });

  it('fails the aggregate when a run exceeds the SLO or has a failed request', () => {
    const summary = summarizeRepeatedRecallProfiles([
      { request: { failures: 0, p95Ms: 410 } },
      { request: { failures: 1, p95Ms: 490 } },
      { request: { failures: 0, p95Ms: 510 } },
    ]);

    expect(summary.failedRequests).toBe(1);
    expect(summary.maxRunP95Ms).toBe(510);
    expect(summary.sloPassed).toBe(false);
  });

  it('retains per-run queue and client timing tails for fairness diagnosis', () => {
    const summary = summarizeRepeatedRecallProfiles([
      { request: { failures: 0, p95Ms: 420, stageTimings: { queue: { p95Ms: 100 }, connection: { p95Ms: 200 } } } },
      { request: { failures: 0, p95Ms: 480, stageTimings: { queue: { p95Ms: 150 }, connection: { p95Ms: 240 } } } },
    ]);

    expect(summary.stageP95MsByRun).toEqual({ queue: [100, 150], connection: [200, 240] });
  });
});
