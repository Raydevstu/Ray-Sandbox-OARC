export type RuntimeOperation = 'retain' | 'recall' | 'mcp';
export type RuntimeOutcome = 'success' | 'failure';

export type RuntimeMetricSample = Readonly<{
  timestamp: string;
  operation: RuntimeOperation;
  durationMs: number;
  outcome: RuntimeOutcome;
  toolName?: string;
}>;

export type RuntimeMetricsSnapshot = Readonly<{
  generatedAt: string;
  windowStartedAt?: string;
  operations: Readonly<Record<RuntimeOperation, number>>;
  successes: number;
  failures: number;
  latency: Readonly<{ p50Ms: number; p95Ms: number }>;
  queue: Readonly<{ queued: number; active: number; deadLettered: number }>;
  mcpTools: Readonly<Record<string, number>>;
  series: readonly RuntimeMetricSample[];
}>;

export type RuntimeMetricsRegistry = Readonly<{
  record: (sample: Omit<RuntimeMetricSample, 'timestamp'>) => void;
  setQueueState: (queue: RuntimeMetricsSnapshot['queue']) => void;
  snapshot: () => RuntimeMetricsSnapshot;
  subscribe: (listener: () => void) => () => void;
}>;

const percentile = (values: readonly number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};

export function createRuntimeMetricsRegistry(options: Readonly<{ now?: () => string; maxSamples?: number }> = {}): RuntimeMetricsRegistry {
  const now = options.now ?? (() => new Date().toISOString());
  const maxSamples = options.maxSamples ?? 120;
  const listeners = new Set<() => void>();
  const samples: RuntimeMetricSample[] = [];
  let queue: RuntimeMetricsSnapshot['queue'] = { queued: 0, active: 0, deadLettered: 0 };

  const notify = () => listeners.forEach((listener) => listener());

  return {
    record(sample) {
      samples.push({ ...sample, timestamp: now() });
      if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples);
      notify();
    },
    setQueueState(nextQueue) {
      queue = { ...nextQueue };
      notify();
    },
    snapshot() {
      const operations: Record<RuntimeOperation, number> = { retain: 0, recall: 0, mcp: 0 };
      const mcpTools: Record<string, number> = {};
      let successes = 0;
      let failures = 0;
      for (const sample of samples) {
        operations[sample.operation] += 1;
        if (sample.outcome === 'success') successes += 1;
        else failures += 1;
        if (sample.operation === 'mcp' && sample.toolName) mcpTools[sample.toolName] = (mcpTools[sample.toolName] ?? 0) + 1;
      }
      const durations = samples.map((sample) => sample.durationMs);
      return {
        generatedAt: now(),
        windowStartedAt: samples[0]?.timestamp,
        operations,
        successes,
        failures,
        latency: { p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95) },
        queue,
        mcpTools,
        series: [...samples],
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const runtimeMetrics = createRuntimeMetricsRegistry();
