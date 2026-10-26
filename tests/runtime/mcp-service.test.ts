import { describe, expect, it, vi } from 'vitest';
import { executeMcpTool, executeReadOnlyMcpTool } from '../../lib/runtime/mcp/service';

const context = {
  provider: 'opencode' as const,
  agentId: 'opencode-agent-a',
  tenantId: 'tenant-a',
  bankId: 'bank-a',
  projectId: 'project-a',
  runId: 'run-a',
};
const principal = { subject: 'agent-a', tenantId: 'tenant-a', scopes: new Set(['memory:read' as const]), allowedProjectIds: ['project-a'], source: 'dev' as const };
const writePrincipal = { ...principal, scopes: new Set(['memory:read' as const, 'memory:write' as const]) };
const emptyRetrieval = { facts: [], traceId: 'trace-a', policy: 'current' as const, packed: { facts: [], tokens: 0, excluded: [] } };

describe('read-only MCP service', () => {
  it('retains a scoped memory only for a write-authorized session', async () => {
    const retain = vi.fn().mockResolvedValue({ fact: { id: 'fact-a' }, evidence: { id: 'evidence-a' }, event: { id: 'event-a' }, replayed: false });

    const result = await executeMcpTool(context, writePrincipal, 'memory_retain', { content: 'Hermes project fact', source: 'hermes', provenance: 'conversation-a', idempotencyKey: 'retain-a', correlationId: 'corr-a' }, {
      isStoreConfigured: () => true,
      createRepository: () => ({}) as never,
      retain,
      recall: async () => emptyRetrieval,
      listProjectEvents: async () => [],
      captureStatus: () => ({ state: 'uncaptured' }),
      now: () => '2026-10-23T00:00:00.000Z',
    });

    expect(result).toMatchObject({ ok: true, data: { projectId: 'project-a', factId: 'fact-a', replayed: false } });
    expect(retain).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-a', content: 'Hermes project fact', idempotencyKey: 'retain-a' }), expect.anything());
  });

  it('runs recall against the session project and returns its bounded result', async () => {
    const recall = vi.fn().mockResolvedValue(emptyRetrieval);

    const result = await executeReadOnlyMcpTool(context, principal, 'memory_recall', { query: 'project decision', correlationId: 'corr-a' }, {
      isStoreConfigured: () => true,
      createRepository: () => ({}) as never,
      recall,
      listProjectEvents: async () => [],
      captureStatus: () => ({ state: 'uncaptured' }),
      now: () => '2026-10-23T00:00:00.000Z',
    });

    expect(recall).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', bankId: 'bank-a', projectId: 'project-a', query: 'project decision' }), expect.anything());
    expect(result).toMatchObject({ ok: true, state: 'empty', data: { traceId: 'trace-a' } });
  });

  it('rejects a project override before recall', async () => {
    const recall = vi.fn();

    await expect(executeReadOnlyMcpTool(context, principal, 'memory_recall', { query: 'project decision', projectId: 'project-b', correlationId: 'corr-a' }, {
      isStoreConfigured: () => true,
      createRepository: () => ({}) as never,
      recall,
      listProjectEvents: async () => [],
      captureStatus: () => ({ state: 'uncaptured' }),
      now: () => '2026-10-23T00:00:00.000Z',
    })).resolves.toMatchObject({ ok: false, state: 'unauthorized', error: 'scope denied' });

    expect(recall).not.toHaveBeenCalled();
  });

  it('reports an unavailable store without creating a repository', async () => {
    const createRepository = vi.fn();

    const result = await executeReadOnlyMcpTool(context, principal, 'memory_get_capture_status', { correlationId: 'corr-a' }, {
      isStoreConfigured: () => false,
      createRepository,
      recall: async () => emptyRetrieval,
      listProjectEvents: async () => [],
      captureStatus: () => ({ state: 'uncaptured' }),
      now: () => '2026-10-23T00:00:00.000Z',
    });

    expect(result).toMatchObject({ ok: false, retryable: true, state: 'unavailable' });
    expect(createRepository).not.toHaveBeenCalled();
  });
});
