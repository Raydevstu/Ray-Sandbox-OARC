import { describe, expect, it } from 'vitest';
import { createRuntimeMetricsRegistry } from '../../lib/runtime/live-metrics';

describe('live runtime metrics registry', () => {
  it('summarizes actual completed operations without creating synthetic samples', () => {
    const registry = createRuntimeMetricsRegistry({ now: () => '2026-10-23T10:00:00.000Z' });

    registry.record({ operation: 'retain', durationMs: 12, outcome: 'success' });
    registry.record({ operation: 'recall', durationMs: 30, outcome: 'failure' });
    registry.record({ operation: 'mcp', durationMs: 20, outcome: 'success', toolName: 'memory_recall' });
    registry.setQueueState({ queued: 2, active: 1, deadLettered: 0 });

    expect(registry.snapshot()).toMatchObject({
      generatedAt: '2026-10-23T10:00:00.000Z',
      operations: { retain: 1, recall: 1, mcp: 1 },
      successes: 2,
      failures: 1,
      queue: { queued: 2, active: 1, deadLettered: 0 },
      mcpTools: { memory_recall: 1 },
      latency: { p50Ms: 20, p95Ms: 30 },
    });
    expect(registry.snapshot().series).toHaveLength(3);
  });

  it('keeps only the newest bounded operation history', () => {
    let tick = 0;
    const registry = createRuntimeMetricsRegistry({ maxSamples: 2, now: () => `2026-10-23T10:00:0${tick++}.000Z` });

    registry.record({ operation: 'retain', durationMs: 1, outcome: 'success' });
    registry.record({ operation: 'retain', durationMs: 2, outcome: 'success' });
    registry.record({ operation: 'retain', durationMs: 3, outcome: 'success' });

    expect(registry.snapshot().series.map((sample) => sample.durationMs)).toEqual([2, 3]);
  });
});
