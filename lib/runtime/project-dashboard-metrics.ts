export type ProjectDashboardScope = Readonly<{ tenantId: string; bankId: string; projectId: string }>;
export type ProjectOperation = 'retain' | 'recall' | 'mcp';
export type ProjectOutcome = 'success' | 'failure';
export type ProjectStage = 'semantic' | 'bm25' | 'graph' | 'temporal' | 'rerank';

export type ProjectOperationObservation = Readonly<{
  operation: ProjectOperation;
  durationMs: number;
  outcome: ProjectOutcome;
  app: string;
  toolName?: string;
  stages?: Partial<Record<ProjectStage, number>>;
}>;

type ProjectMetricSample = ProjectOperationObservation & Readonly<{ timestamp: string }>;
export type ProjectQueueState = Readonly<{ queued: number; active: number; deadLettered: number; measured: boolean }>;
type Percentile = Readonly<{ p50Ms: number; p95Ms: number; measured: boolean }>;

export type ProjectRuntimeSnapshot = Readonly<{
  generatedAt: string;
  operations: Readonly<Record<ProjectOperation, number>>;
  successes: number;
  failures: number;
  latency: Percentile;
  stages: Readonly<Partial<Record<ProjectStage, Percentile>>>;
  queue: ProjectQueueState;
  mcpTools: Readonly<Record<string, number>>;
  apps: Readonly<Record<string, Readonly<{ successes: number; failures: number }>>>;
  series: readonly ProjectMetricSample[];
}>;

export type ProjectDashboardMetricsRegistry = Readonly<{
  recordProjectOperation: (scope: ProjectDashboardScope, observation: ProjectOperationObservation) => void;
  setProjectQueueState: (scope: ProjectDashboardScope, queue: ProjectQueueState) => void;
  snapshot: (scope: ProjectDashboardScope) => ProjectRuntimeSnapshot;
  subscribe: (scope: ProjectDashboardScope, listener: () => void) => () => void;
}>;

const keyFor = (scope: ProjectDashboardScope) => `${scope.tenantId}:${scope.bankId}:${scope.projectId}`;
const percentile = (values: readonly number[], quantile: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? 0;
};
const measuredPercentile = (values: readonly number[]): Percentile => values.length ? { p50Ms: percentile(values, 0.5), p95Ms: percentile(values, 0.95), measured: true } : { p50Ms: 0, p95Ms: 0, measured: false };

export function createProjectDashboardMetricsRegistry(options: Readonly<{ now?: () => string; maxSamples?: number }> = {}): ProjectDashboardMetricsRegistry {
  const now = options.now ?? (() => new Date().toISOString());
  const maxSamples = options.maxSamples ?? 120;
  const samplesByProject = new Map<string, ProjectMetricSample[]>();
  const queuesByProject = new Map<string, ProjectQueueState>();
  const listenersByProject = new Map<string, Set<() => void>>();
  const notify = (key: string) => listenersByProject.get(key)?.forEach((listener) => listener());

  return {
    recordProjectOperation(scope, observation) {
      const key = keyFor(scope);
      const samples = samplesByProject.get(key) ?? [];
      samples.push({ ...observation, timestamp: now() });
      if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples);
      samplesByProject.set(key, samples);
      notify(key);
    },
    setProjectQueueState(scope, queue) {
      const key = keyFor(scope);
      queuesByProject.set(key, { ...queue });
      notify(key);
    },
    snapshot(scope) {
      const samples = samplesByProject.get(keyFor(scope)) ?? [];
      const operations: Record<ProjectOperation, number> = { retain: 0, recall: 0, mcp: 0 };
      const mcpTools: Record<string, number> = {};
      const apps: Record<string, { successes: number; failures: number }> = {};
      const stageValues: Partial<Record<ProjectStage, number[]>> = {};
      let successes = 0;
      let failures = 0;
      for (const sample of samples) {
        operations[sample.operation] += 1;
        if (sample.outcome === 'success') successes += 1;
        else failures += 1;
        const app = apps[sample.app] ?? { successes: 0, failures: 0 };
        if (sample.outcome === 'success') app.successes += 1;
        else app.failures += 1;
        apps[sample.app] = app;
        if (sample.operation === 'mcp' && sample.toolName) mcpTools[sample.toolName] = (mcpTools[sample.toolName] ?? 0) + 1;
        for (const [stage, durationMs] of Object.entries(sample.stages ?? {}) as [ProjectStage, number][]) (stageValues[stage] ??= []).push(durationMs);
      }
      const stages = Object.fromEntries(Object.entries(stageValues).map(([stage, values]) => [stage, measuredPercentile(values)])) as Partial<Record<ProjectStage, Percentile>>;
      return { generatedAt: now(), operations, successes, failures, latency: measuredPercentile(samples.map((sample) => sample.durationMs)), stages, queue: queuesByProject.get(keyFor(scope)) ?? { queued: 0, active: 0, deadLettered: 0, measured: false }, mcpTools, apps, series: [...samples] };
    },
    subscribe(scope, listener) {
      const key = keyFor(scope);
      const listeners = listenersByProject.get(key) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByProject.set(key, listeners);
      return () => listeners.delete(listener);
    },
  };
}

export const projectDashboardMetrics = createProjectDashboardMetricsRegistry();
