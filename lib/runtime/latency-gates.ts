import { performance } from 'node:perf_hooks';

export type LatencyGate = Readonly<{ name: string; p50Ms: number; p95Ms: number; p99Ms: number }>;
export type LatencyMeasurement = Readonly<{ iterations: number; p50Ms: number; p95Ms: number; p99Ms: number; samplesMs: readonly number[] }>;

const percentile = (samples: readonly number[], rank: number): number => {
  const ordered = [...samples].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * rank) - 1)] ?? 0;
};

export const measureLocalLatency = (operation: () => unknown, options: Readonly<{ warmupIterations?: number; measuredIterations?: number }> = {}): LatencyMeasurement => {
  const warmupIterations = options.warmupIterations ?? 10;
  const measuredIterations = options.measuredIterations ?? 100;
  for (let index = 0; index < warmupIterations; index += 1) operation();
  const samplesMs = Array.from({ length: measuredIterations }, () => {
    const started = performance.now();
    operation();
    return performance.now() - started;
  });
  return { iterations: measuredIterations, samplesMs, p50Ms: percentile(samplesMs, 0.5), p95Ms: percentile(samplesMs, 0.95), p99Ms: percentile(samplesMs, 0.99) };
};

export const assertLatencyGate = (measurement: LatencyMeasurement, gate: LatencyGate): void => {
  for (const percentileName of ['p50Ms', 'p95Ms', 'p99Ms'] as const) {
    if (measurement[percentileName] > gate[percentileName]) throw new Error(`${gate.name} ${percentileName} ${measurement[percentileName].toFixed(3)}ms exceeds ${gate[percentileName]}ms`);
  }
};
