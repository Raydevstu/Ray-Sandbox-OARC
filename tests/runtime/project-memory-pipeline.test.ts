import { describe, expect, it } from 'vitest';
import { ProjectMemoryPipeline } from '../../lib/runtime/project-memory-pipeline';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const sourceEvent = (id: string, content: string, sequence = 1) => ({ tenantId: 't1', bankId: 'b1', id, projectId: 'p1', type: 'CodexConversationMessage', payload: { conversation: { tenantId: 't1', bankId: 'b1', projectId: 'p1', platform: 'codex', conversationId: 'c1', messageId: id, role: 'user', content, timestamp: '2026-10-08T00:00:00.000Z' } }, occurredAt: '2026-10-08T00:00:00.000Z', sequence });
const options = { consumer: 'memory-projector', maxQueue: 8, concurrency: 1, maxAttempts: 1, now: () => '2026-10-08T00:00:01.000Z' };

describe('project memory pipeline', () => {
  it('extracts, governs, persists, and emits replayable memory events', async () => {
    const repository = new TestRepository('t1');
    const event = sourceEvent('e1', 'Decision: we will use PostgreSQL for durable project memory.');
    await repository.appendProjectEvent(event);
    const pipeline = new ProjectMemoryPipeline(repository, { tenantId: 't1', bankId: 'b1' }, options);
    expect(pipeline.enqueue(event)).toBe(true);
    const result = await pipeline.run();
    expect(result.telemetry.processed).toBe(1);
    const records = await repository.listProjectMemory({ tenantId: 't1', bankId: 'b1' }, 'p1');
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe('decision');
    const events = await repository.listProjectEvents({ tenantId: 't1', bankId: 'b1' }, 'p1');
    expect(events.some((candidate) => candidate.type === 'ProjectMemoryRecorded')).toBe(true);
  });

  it('is idempotent when the same source event is delivered twice', async () => {
    const repository = new TestRepository('t1');
    const event = sourceEvent('e1', 'Requirement: the project must preserve exact provenance.');
    await repository.appendProjectEvent(event);
    const pipeline = new ProjectMemoryPipeline(repository, { tenantId: 't1', bankId: 'b1' }, options);
    pipeline.enqueue(event); pipeline.enqueue(event); await pipeline.run();
    expect(await repository.listProjectMemory({ tenantId: 't1', bankId: 'b1' }, 'p1')).toHaveLength(1);
    expect((await repository.listProjectEvents({ tenantId: 't1', bankId: 'b1' }, 'p1')).filter((candidate) => candidate.type === 'ProjectMemoryRecorded')).toHaveLength(1);
  });
});
