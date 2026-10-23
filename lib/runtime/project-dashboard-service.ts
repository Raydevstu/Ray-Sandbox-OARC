import type { CanonicalRepository } from './repositories/interfaces';
import type { ProjectDashboardMetricsRegistry, ProjectDashboardScope, ProjectRuntimeSnapshot } from './project-dashboard-metrics';

type DashboardEvent = Readonly<{ id: string; type: string; occurredAt: string; sequence: number }>;
export type ProjectDashboardSnapshot = Readonly<{
  projectId: string;
  generatedAt: string;
  runtime: ProjectRuntimeSnapshot;
  durable: Readonly<{ state: 'measured' | 'empty'; memoryCount: number; confidenceMean: number | null; networkMix: Readonly<{ world: number; experience: number; observation: number; opinion: number }> }>;
  events: readonly DashboardEvent[];
  worker: Readonly<{ accepted: number; persisted: number; queued: number; completed: number; failed: number; deadLettered: number; recallVisible: number }>;
}>;

const networkFor = (type: string): keyof ProjectDashboardSnapshot['durable']['networkMix'] | undefined => ({ implementation: 'world', requirement: 'world', decision: 'experience', runtime: 'experience', test: 'observation', benchmark: 'observation', risk: 'opinion', blocker: 'opinion' }[type] as keyof ProjectDashboardSnapshot['durable']['networkMix'] | undefined);

export async function readProjectDashboardSnapshot(scope: ProjectDashboardScope, dependencies: Readonly<{ metrics: ProjectDashboardMetricsRegistry; repository: CanonicalRepository }>): Promise<ProjectDashboardSnapshot> {
  const [records, facts, events] = await Promise.all([
    dependencies.repository.listProjectMemory(scope, scope.projectId),
    dependencies.repository.findFacts(scope),
    dependencies.repository.listProjectEvents(scope, scope.projectId),
  ]);
  const networkMix = { world: 0, experience: 0, observation: 0, opinion: 0 };
  for (const record of records) {
    const network = networkFor(record.type);
    if (network) networkMix[network] += 1;
  }
  const canonicalMemories = facts.length ? facts : records;
  const confidenceMean = canonicalMemories.length ? Number((canonicalMemories.reduce((sum, record) => sum + record.confidence, 0) / canonicalMemories.length).toFixed(4)) : null;
  const mcpEventCount = events.filter((event) => event.type === 'McpGatewayToolCalled').length;
  const worker = {
    accepted: mcpEventCount,
    persisted: mcpEventCount,
    queued: events.filter((event) => event.type === 'McpGatewayToolCalled').length,
    completed: events.filter((event) => event.type === 'ProjectWorkerCompleted').length,
    failed: events.filter((event) => event.type === 'ProjectWorkerFailed').length,
    deadLettered: events.filter((event) => event.type === 'ProjectWorkerDeadLettered').length,
    recallVisible: facts.length,
  };
  const observed = dependencies.metrics.snapshot(scope);
  const durableMcpSamples = events
    .filter((event) => event.type === 'McpGatewayToolCalled')
    .map((event) => {
      const payload = (event.payload && typeof event.payload === 'object' ? event.payload : {}) as { observation?: { durationMs?: unknown; outcome?: unknown }; provider?: unknown; toolName?: unknown };
      const durationMs = payload.observation?.durationMs;
      const outcome = payload.observation?.outcome;
      if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || (outcome !== 'success' && outcome !== 'failure')) return undefined;
      return { operation: 'mcp' as const, durationMs, outcome: outcome as 'success' | 'failure', app: typeof payload.provider === 'string' ? payload.provider : 'mcp', toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined, timestamp: event.occurredAt };
    })
    .filter((sample): sample is NonNullable<typeof sample> => Boolean(sample));
  const durableRuntime = durableMcpSamples.length && !observed.series.length
    ? { ...observed, operations: { ...observed.operations, mcp: durableMcpSamples.length }, successes: durableMcpSamples.filter((sample) => sample.outcome === 'success').length, failures: durableMcpSamples.filter((sample) => sample.outcome === 'failure').length, latency: { p50Ms: durableMcpSamples.map((sample) => sample.durationMs).sort((a, b) => a - b)[Math.min(durableMcpSamples.length - 1, Math.ceil(durableMcpSamples.length * 0.5) - 1)] ?? 0, p95Ms: durableMcpSamples.map((sample) => sample.durationMs).sort((a, b) => a - b)[Math.min(durableMcpSamples.length - 1, Math.ceil(durableMcpSamples.length * 0.95) - 1)] ?? 0, measured: true }, series: durableMcpSamples }
    : observed;
  const runtime = mcpEventCount > durableRuntime.operations.mcp ? {
    ...durableRuntime,
    operations: { ...durableRuntime.operations, mcp: mcpEventCount },
    successes: Math.max(durableRuntime.successes, mcpEventCount),
  } : durableRuntime;
  return {
    projectId: scope.projectId,
    generatedAt: dependencies.metrics.snapshot(scope).generatedAt,
    runtime,
    durable: { state: canonicalMemories.length ? 'measured' : 'empty', memoryCount: canonicalMemories.length, confidenceMean, networkMix },
    events: events.slice(-50).map(({ id, type, occurredAt, sequence }) => ({ id, type, occurredAt, sequence })),
    worker,
  };
}
