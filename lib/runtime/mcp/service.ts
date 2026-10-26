import type { Principal } from '../auth';
import { authorize } from '../auth';
import type { CaptureStatus } from '../capture-status';
import type { ProjectEvent } from '../contracts';
import { generateProjectManifest } from '../project-manifest';
import { replayProjectMemoryAtSequence } from '../project-memory';
import type { RuntimeRetrievalRequest } from '../retrieval';
import type { CanonicalRepository } from '../repositories/interfaces';
import type { McpConnectorContext } from './sessions';

export type ReadOnlyMcpToolName = 'memory_recall' | 'memory_trace' | 'memory_get_project_state' | 'memory_get_capture_status';
export type McpToolName = ReadOnlyMcpToolName | 'memory_retain';

export type McpToolResult = Readonly<{
  ok: boolean;
  state: 'healthy' | 'empty' | 'unavailable' | 'unauthorized' | 'failed';
  data?: Record<string, unknown>;
  error?: string;
  retryable?: boolean;
}>;

export type McpServiceDependencies = Readonly<{
  isStoreConfigured(): boolean;
  createRepository(scope: { tenantId: string; bankId: string }): CanonicalRepository;
  recall(input: RuntimeRetrievalRequest, repository: CanonicalRepository): ReturnType<typeof import('../retrieval').recallMemory>;
  retain?(input: Record<string, unknown>, repository: CanonicalRepository): Promise<unknown>;
  listProjectEvents(repository: CanonicalRepository, scope: { tenantId: string; bankId: string }, projectId: string): Promise<readonly ProjectEvent[]>;
  captureStatus(): CaptureStatus | Readonly<Record<string, unknown>>;
  now(): string;
}>;

const scopedKeys = ['tenantId', 'bankId', 'projectId', 'agentId', 'provider', 'conversationId', 'runId'] as const;

const scopeMatches = (context: McpConnectorContext, input: Record<string, unknown>): boolean => scopedKeys.every((key) => input[key] === undefined || input[key] === context[key]);

const isToolName = (value: string): value is ReadOnlyMcpToolName => ['memory_recall', 'memory_trace', 'memory_get_project_state', 'memory_get_capture_status'].includes(value);

export async function executeReadOnlyMcpTool(
  context: McpConnectorContext,
  principal: Principal,
  name: string,
  input: Record<string, unknown>,
  dependencies: McpServiceDependencies,
): Promise<McpToolResult> {
  if (!isToolName(name)) return { ok: false, state: 'failed', error: 'Unknown tool' };
  if (!scopeMatches(context, input)) return { ok: false, state: 'unauthorized', error: 'scope denied' };
  if (typeof input.correlationId !== 'string' || !input.correlationId.trim()) return { ok: false, state: 'failed', error: 'invalid MCP request parameters' };
  try {
    const scope = { tenantId: context.tenantId, bankId: context.bankId };
    authorize(principal, 'memory:read', scope);
    if (!dependencies.isStoreConfigured()) return { ok: false, state: 'unavailable', error: 'canonical store is not configured', retryable: true };
    const repository = dependencies.createRepository(scope);
    if (name === 'memory_get_capture_status') return { ok: true, state: 'healthy', data: { capture: dependencies.captureStatus(), correlationId: input.correlationId } };
    if (name === 'memory_get_project_state') {
      const events = await dependencies.listProjectEvents(repository, scope, context.projectId);
      const atSequence = typeof input.atSequence === 'number' && Number.isInteger(input.atSequence) && input.atSequence > 0 ? input.atSequence : undefined;
      return { ok: true, state: 'healthy', data: { manifest: generateProjectManifest(context.projectId, replayProjectMemoryAtSequence(events, atSequence), dependencies.now()), correlationId: input.correlationId } };
    }
    if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 2_000) return { ok: false, state: 'failed', error: 'invalid MCP request parameters' };
    const retrieval = await dependencies.recall({ tenantId: context.tenantId, bankId: context.bankId, projectId: context.projectId, query: input.query, ...(typeof input.limit === 'number' ? { limit: input.limit } : {}), ...(typeof input.tokenBudget === 'number' ? { tokenBudget: input.tokenBudget } : {}), ...(input.policy === 'current' || input.policy === 'historical' || input.policy === 'all-evidence' ? { policy: input.policy } : {}) }, repository);
    if (name === 'memory_recall') return { ok: true, state: retrieval.facts.length === 0 ? 'empty' : 'healthy', data: { ...retrieval, correlationId: input.correlationId } };
    return {
      ok: true,
      state: retrieval.facts.length === 0 ? 'empty' : 'healthy',
      data: {
        projectId: context.projectId,
        correlationId: input.correlationId,
        trace: {
          traceId: retrieval.traceId,
          query: input.query,
          items: retrieval.facts.map((fact, index) => ({
            recordId: fact.id,
            score: Math.max(0, 1 - index / Math.max(1, retrieval.facts.length)),
            confidence: fact.confidence,
            evidenceReferences: fact.evidenceIds,
            rationale: 'selected by scoped lexical retrieval',
            createdAt: fact.createdAt,
            updatedAt: fact.createdAt,
            status: 'active',
          })),
        },
      },
    };
  } catch (error) {
    return { ok: false, state: 'unauthorized', error: error instanceof Error && error.message.includes('permission') ? 'scope denied' : 'MCP request failed' };
  }
}

export async function executeMcpTool(context: McpConnectorContext, principal: Principal, name: string, input: Record<string, unknown>, dependencies: McpServiceDependencies): Promise<McpToolResult> {
  if (isToolName(name)) return executeReadOnlyMcpTool(context, principal, name, input, dependencies);
  if (name !== 'memory_retain') return { ok: false, state: 'failed', error: 'Unknown tool' };
  if (!dependencies.retain) return { ok: false, state: 'unavailable', error: 'MCP retain is not configured', retryable: true };
  if (!scopeMatches(context, input)) return { ok: false, state: 'unauthorized', error: 'scope denied' };
  try {
    authorize(principal, 'memory:write', { tenantId: context.tenantId, bankId: context.bankId });
    if (!dependencies.isStoreConfigured()) return { ok: false, state: 'unavailable', error: 'canonical store is not configured', retryable: true };
    const content = typeof input.content === 'string' ? input.content.trim() : '';
    const source = typeof input.source === 'string' ? input.source.trim() : '';
    const provenance = typeof input.provenance === 'string' ? input.provenance.trim() : '';
    const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
    if (!content || !source || !provenance || !idempotencyKey || typeof input.correlationId !== 'string' || !input.correlationId.trim()) return { ok: false, state: 'failed', error: 'invalid MCP request parameters' };
    const result = await dependencies.retain({ tenantId: context.tenantId, bankId: context.bankId, projectId: context.projectId, content, source, provenance, idempotencyKey }, dependencies.createRepository({ tenantId: context.tenantId, bankId: context.bankId }));
    const retained = result as { fact?: { id?: string }; evidence?: { id?: string }; event?: { id?: string }; replayed?: boolean };
    return { ok: true, state: 'healthy', data: { projectId: context.projectId, factId: retained.fact?.id, evidenceId: retained.evidence?.id, eventId: retained.event?.id, replayed: retained.replayed === true, correlationId: input.correlationId } };
  } catch (error) {
    return { ok: false, state: 'failed', error: error instanceof Error && error.message.includes('permission') ? 'scope denied' : error instanceof Error ? error.message : 'MCP retain failed' };
  }
}
