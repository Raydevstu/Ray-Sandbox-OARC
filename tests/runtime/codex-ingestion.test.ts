import { describe, expect, it } from 'vitest';
import { normalizeCodexMcpEvent, normalizeCodexToolEvent, normalizeCodexProjectSession, persistCodexProjectEvent } from '../../lib/runtime/codex-ingestion';
import { replayProjectMemory } from '../../lib/runtime/project-memory';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const scope = { tenantId: 't1', bankId: 'b1' } as const;
const metadata = { projectId: 'p1', conversationId: 'c1', timestamp: '2026-10-07T00:00:00.000Z' } as const;
describe('Codex project ingestion', () => {
  it('normalizes MCP calls, tool results, and project sessions with provenance', () => {
    const mcp = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm1', method: 'tools/call', name: 'memory_recall' });
    const tool = normalizeCodexToolEvent(scope, metadata, { messageId: 'm2', name: 'memory_recall', result: { facts: [] } });
    const session = normalizeCodexProjectSession(scope, metadata, { sessionId: 's1', branch: 'main', startedAt: metadata.timestamp });
    expect(mcp.type).toBe('CodexConversationEvent');
    expect(tool.payload.source).toMatchObject({ platform: 'codex', conversationId: 'c1' });
    expect(session.payload).toMatchObject({ source: { platform: 'codex' } });
  });
  it('deduplicates identical source events and assigns ordered sequences', async () => {
    const repository = new TestRepository('t1');
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm1', method: 'tools/call' });
    await expect(persistCodexProjectEvent(repository, event)).resolves.toMatchObject({ duplicate: false, event: { sequence: 1 } });
    await expect(persistCodexProjectEvent(repository, event)).resolves.toMatchObject({ duplicate: true, event: { sequence: 1 } });
    expect((await repository.listProjectEvents(scope, 'p1'))).toHaveLength(1);
  });
  it('rejects missing connector metadata and cross-scope persistence', async () => {
    expect(() => normalizeCodexMcpEvent(scope, { ...metadata, projectId: '' }, { messageId: 'm1', method: 'tools/call' })).toThrow('metadata');
    const repository = new TestRepository('t1');
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm1', method: 'tools/call' });
    await expect(persistCodexProjectEvent(repository, { ...event, tenantId: 't2' })).rejects.toThrow('scope');
  });
  it('does not fail source ingestion when bounded dispatch rejects', async () => {
    const repository = new TestRepository('t1');
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm-async', method: 'chat', content: 'Decision: preserve the event stream.' });
    const result = await persistCodexProjectEvent(repository, event, { enqueue: () => { throw new Error('queue full'); } });
    expect(result).toMatchObject({ duplicate: false, queued: false, event: { sequence: 1 } });
    expect(await repository.listProjectEvents(scope, 'p1')).toHaveLength(1);
  });
  it('keeps Codex events replay-compatible without treating conversations as memory records', async () => {
    const repository = new TestRepository('t1');
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm1', method: 'tools/call' });
    await persistCodexProjectEvent(repository, event);
    const projection = replayProjectMemory(await repository.listProjectEvents(scope, 'p1'));
    expect(Object.keys(projection.records)).toHaveLength(0);
  });
});
