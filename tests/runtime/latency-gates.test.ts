import { describe, expect, it } from 'vitest';
import { assertLatencyGate, measureLocalLatency, type LatencyGate } from '../../lib/runtime/latency-gates';

describe('local latency gates', () => {
  it('reports percentile measurements and enforces the configured gate', () => {
    const measurement = measureLocalLatency(() => 'ok', { warmupIterations: 2, measuredIterations: 20 });
    const gate: LatencyGate = { name: 'unit-operation', p50Ms: 100, p95Ms: 100, p99Ms: 100 };
    expect(measurement.iterations).toBe(20);
    expect(measurement.p50Ms).toBeGreaterThanOrEqual(0);
    expect(measurement.p95Ms).toBeGreaterThanOrEqual(measurement.p50Ms);
    expect(() => assertLatencyGate(measurement, gate)).not.toThrow();
  });

  it('rejects a measurement that exceeds a percentile threshold', () => {
    expect(() => assertLatencyGate({ iterations: 1, p50Ms: 2, p95Ms: 6, p99Ms: 9, samplesMs: [2] }, { name: 'too-slow', p50Ms: 1, p95Ms: 10, p99Ms: 10 })).toThrow(/p50/);
  });
});
