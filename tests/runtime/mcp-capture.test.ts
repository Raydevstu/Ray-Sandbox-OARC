import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCaptureStatus, resetCaptureStatus } from '../../lib/runtime/capture-status';
import { captureMcpGatewayEvent } from '../../lib/runtime/mcp/capture';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const context = {
  provider: 'opencode' as const,
  agentId: 'opencode-agent-a',
  tenantId: 'tenant-a',
  bankId: 'bank-a',
  projectId: 'project-a',
  runId: 'run-a',
};

afterEach(() => resetCaptureStatus());

describe('MCP gateway capture', () => {
  it('persists a redacted provider-labelled event before queue acknowledgement', async () => {
    const repository = new TestRepository('tenant-a');
    const enqueue = vi.fn(() => true);

    const result = await captureMcpGatewayEvent(repository, context, {
      correlationId: 'corr-a',
      toolName: 'memory_recall',
      timestamp: '2026-10-23T00:00:00.000Z',
      requestSummary: { authorization: 'Bearer private', apiKey: 'private', query: 'safe query' },
    }, { enqueue });

    expect(result).toMatchObject({ duplicate: false, queued: true });
    expect(JSON.stringify(result.event)).toContain('opencode');
    expect(JSON.stringify(result.event)).toContain('corr-a');
    expect(JSON.stringify(result.event)).not.toContain('private');
    expect(getCaptureStatus()).toMatchObject({ persisted: 1, queued: 1 });
  });

  it('uses deterministic identity for a duplicate gateway event', async () => {
    const repository = new TestRepository('tenant-a');
    const event = { correlationId: 'corr-a', toolName: 'memory_recall', timestamp: '2026-10-23T00:00:00.000Z', requestSummary: {} };

    const first = await captureMcpGatewayEvent(repository, context, event);
    const second = await captureMcpGatewayEvent(repository, context, event);

    expect(second).toMatchObject({ duplicate: true, queued: false, event: { id: first.event.id } });
  });

  it('awaits the durable async enqueue before acknowledging capture', async () => {
    const repository = new TestRepository('tenant-a');
    let completed = false;
    const enqueueAsync = vi.fn(async () => {
      await Promise.resolve();
      completed = true;
      return true;
    });

    const result = await captureMcpGatewayEvent(repository, context, {
      correlationId: 'corr-async',
      toolName: 'memory_recall',
      timestamp: '2026-10-23T00:00:00.000Z',
      requestSummary: {},
    }, { enqueue: () => false, enqueueAsync });

    expect(enqueueAsync).toHaveBeenCalledOnce();
    expect(completed).toBe(true);
    expect(result.queued).toBe(true);
  });
});
