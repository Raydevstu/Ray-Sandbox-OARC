export type RecallTimingPercentiles = Readonly<{
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}>;

const percentile = (values: readonly number[], rank: number): number => {
  const ordered = [...values].sort((left, right) => left - right);
  return Number((ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * rank) - 1)] ?? 0).toFixed(2));
};

export const summarizeRecallServerTimings = (samples: readonly string[]): Readonly<Record<string, RecallTimingPercentiles>> => {
  const values = new Map<string, number[]>();
  for (const sample of samples) {
    for (const match of sample.matchAll(/([a-z]+);dur=([0-9]+(?:\.[0-9]+)?)/g)) {
      const duration = Number(match[2]);
      if (!Number.isFinite(duration)) continue;
      const stage = match[1];
      values.set(stage, [...(values.get(stage) ?? []), duration]);
    }
  }
  return Object.fromEntries([...values.entries()].map(([stage, durations]) => [stage, {
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: Number(Math.max(...durations).toFixed(2)),
  }]));
};

export const summarizeRecallLeaseFairness = (samples: readonly string[]) => {
  const leases = samples.flatMap((sample) => [...sample.matchAll(/leaseSequence=([0-9]+), leaseWait=([0-9]+(?:\.[0-9]+)?)/g)].map((match) => ({ sequence: Number(match[1]), waitMs: Number(match[2]) })));
  const waitMs = leases.map((lease) => lease.waitMs);
  let sequenceInversions = 0;
  for (let index = 1; index < leases.length; index += 1) if (leases[index].sequence < leases[index - 1].sequence) sequenceInversions += 1;
  return {
    samples: leases.length,
    sequenceInversions,
    maxSequence: Math.max(...leases.map((lease) => lease.sequence), 0),
    waitMs: {
      p50Ms: percentile(waitMs, 0.5),
      p95Ms: percentile(waitMs, 0.95),
      p99Ms: percentile(waitMs, 0.99),
      maxMs: Number(Math.max(...waitMs, 0).toFixed(2)),
    },
  };
};
