import { describe, expect, it } from 'vitest';
import { createProjectDashboardMetricsRegistry } from '../../lib/runtime/project-dashboard-metrics';
import { readProjectDashboardSnapshot } from '../../lib/runtime/project-dashboard-service';

const scope = { tenantId: 'tenant-a', bankId: 'bank-a', projectId: 'project-a' } as const;

describe('project dashboard snapshot service', () => {
  it('combines only scoped durable records and observed metrics', async () => {
    const metrics = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });
    metrics.recordProjectOperation(scope, { operation: 'recall', durationMs: 18, outcome: 'success', app: 'memory' });
    const repository = {
      listProjectMemory: async () => [
        { projectId: 'project-a', type: 'decision', confidence: 0.8 },
        { projectId: 'project-a', type: 'requirement', confidence: 0.6 },
      ],
      findFacts: async () => [],
      listProjectEvents: async () => [{ id: 'event-a', type: 'ProjectMemoryRecorded', occurredAt: '2026-10-23T09:00:00.000Z', sequence: 1 }],
    };

    const snapshot = await readProjectDashboardSnapshot(scope, { metrics, repository: repository as never });

    expect(snapshot).toMatchObject({
      projectId: 'project-a',
      durable: { state: 'measured', memoryCount: 2, confidenceMean: 0.7, networkMix: { world: 1, experience: 1, observation: 0, opinion: 0 } },
      events: [{ id: 'event-a', type: 'ProjectMemoryRecorded' }],
      runtime: { operations: { recall: 1 } },
    });
  });

  it('reports an authorized empty project without fabricating durable history', async () => {
    const metrics = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });
    const repository = { listProjectMemory: async () => [], findFacts: async () => [], listProjectEvents: async () => [] };

    const snapshot = await readProjectDashboardSnapshot(scope, { metrics, repository: repository as never });

    expect(snapshot.durable).toMatchObject({ state: 'empty', memoryCount: 0, confidenceMean: null });
    expect(snapshot.events).toEqual([]);
  });

  it('projects successful MCP events into operation counts when process metrics are unavailable', async () => {
    const metrics = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });
    const repository = { listProjectMemory: async () => [], findFacts: async () => [], listProjectEvents: async () => [
      { id: 'event-a', type: 'McpGatewayToolCalled', occurredAt: '2026-10-23T09:00:00.000Z', sequence: 1 },
      { id: 'event-b', type: 'McpGatewayToolCalled', occurredAt: '2026-10-23T09:01:00.000Z', sequence: 2 },
    ] };

    const snapshot = await readProjectDashboardSnapshot(scope, { metrics, repository: repository as never });

    expect(snapshot.runtime.operations.mcp).toBe(2);
    expect(snapshot.runtime.successes).toBe(2);
    expect(snapshot.runtime.latency.measured).toBe(false);
  });

  it('rebuilds measured MCP latency from durable event observations', async () => {
    const metrics = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });
    const repository = {
      listProjectMemory: async () => [],
      findFacts: async () => [],
      listProjectEvents: async () => [{
        id: 'event-measured',
        type: 'McpGatewayToolCalled',
        occurredAt: '2026-10-23T09:00:00.000Z',
        sequence: 1,
        payload: { provider: 'hermes', observation: { durationMs: 42, outcome: 'success' } },
      }],
    };

    const snapshot = await readProjectDashboardSnapshot(scope, { metrics, repository: repository as never });

    expect(snapshot.runtime.latency).toMatchObject({ p50Ms: 42, p95Ms: 42, measured: true });
    expect(snapshot.runtime.series).toHaveLength(1);
  });

  it('shows canonical retained facts when no project-memory projection exists yet', async () => {
    const metrics = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });
    const repository = {
      listProjectMemory: async () => [],
      findFacts: async () => [{ id: 'fact-a', projectId: 'project-a', confidence: 0.9 }],
      listProjectEvents: async () => [],
    };

    const snapshot = await readProjectDashboardSnapshot(scope, { metrics, repository: repository as never });

    expect(snapshot.durable).toMatchObject({ state: 'measured', memoryCount: 1, confidenceMean: 0.9 });
  });
});
