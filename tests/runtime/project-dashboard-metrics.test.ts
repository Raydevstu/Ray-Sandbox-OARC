import { describe, expect, it } from 'vitest';
import { createProjectDashboardMetricsRegistry } from '../../lib/runtime/project-dashboard-metrics';

const scope = { tenantId: 'tenant-a', bankId: 'bank-a', projectId: 'project-a' } as const;

describe('project dashboard metrics registry', () => {
  it('derives one project snapshot from observed operations only', () => {
    const registry = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z', maxSamples: 2 });

    registry.recordProjectOperation(scope, { operation: 'retain', durationMs: 10, outcome: 'success', app: 'memory' });
    registry.recordProjectOperation(scope, { operation: 'recall', durationMs: 30, outcome: 'failure', app: 'memory', stages: { semantic: 12 } });
    registry.recordProjectOperation(scope, { operation: 'mcp', durationMs: 20, outcome: 'success', app: 'hermes', toolName: 'memory_recall' });
    registry.setProjectQueueState(scope, { queued: 2, active: 1, deadLettered: 0, measured: true });

    expect(registry.snapshot(scope)).toMatchObject({
      operations: { retain: 0, recall: 1, mcp: 1 },
      successes: 1,
      failures: 1,
      latency: { p50Ms: 20, p95Ms: 30, measured: true },
      stages: { semantic: { p50Ms: 12, p95Ms: 12, measured: true } },
      queue: { queued: 2, active: 1, deadLettered: 0, measured: true },
      mcpTools: { memory_recall: 1 },
      apps: { memory: { successes: 0, failures: 1 }, hermes: { successes: 1, failures: 0 } },
    });
    expect(registry.snapshot(scope).series).toHaveLength(2);
  });

  it('does not expose another project or invent a zero queue measurement', () => {
    const registry = createProjectDashboardMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });
    registry.recordProjectOperation(scope, { operation: 'retain', durationMs: 10, outcome: 'success', app: 'memory' });

    expect(registry.snapshot({ ...scope, projectId: 'project-b' })).toMatchObject({
      operations: { retain: 0, recall: 0, mcp: 0 },
      queue: { measured: false },
      latency: { measured: false },
      series: [],
    });
  });
});
