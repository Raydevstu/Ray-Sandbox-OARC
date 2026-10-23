import { recordCapture } from '../capture-status';
import { stableId, type ProjectEvent } from '../contracts';
import type { CanonicalRepository } from '../repositories/interfaces';
import type { McpConnectorContext } from './sessions';

type GatewayEventInput = Readonly<{
  correlationId: string;
  toolName: string;
  timestamp: string;
  requestSummary: Readonly<Record<string, unknown>>;
  observation?: Readonly<{ durationMs: number; outcome: 'success' | 'failure' }>;
}>;

type AsyncEnqueuer = Readonly<{ enqueue(event: ProjectEvent): boolean; enqueueAsync?: (event: ProjectEvent) => Promise<boolean> }>;

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, /token|secret|password|authorization|api[-_]?key/i.test(key) ? '[REDACTED_SECRET]' : redact(entry)]));
};

const gatewayEvent = (context: McpConnectorContext, input: GatewayEventInput): ProjectEvent => {
  const scope = { tenantId: context.tenantId, bankId: context.bankId };
  const messageId = stableId('mcp-gateway-message', context.provider, context.agentId, context.projectId, context.conversationId ?? context.runId ?? '', input.correlationId, input.toolName);
  const conversationId = context.conversationId ?? context.runId ?? '';
  return {
    ...scope,
    id: stableId('mcp-gateway-event', messageId),
    projectId: context.projectId,
    type: 'McpGatewayToolCalled',
    occurredAt: input.timestamp,
    sequence: 0,
    payload: {
      conversation: {
        ...scope,
        projectId: context.projectId,
        platform: context.provider,
        conversationId,
        messageId,
        role: 'tool',
        content: `MCP tools/call ${input.toolName}`,
        timestamp: input.timestamp,
        toolCalls: [{ name: input.toolName, arguments: redact(input.requestSummary) }],
      },
      source: { platform: context.provider, conversationId, messageId, timestamp: input.timestamp },
      agentId: context.agentId,
      provider: context.provider,
      correlationId: input.correlationId,
      observation: input.observation,
    },
  };
};

export async function captureMcpGatewayEvent(repository: CanonicalRepository, context: McpConnectorContext, input: GatewayEventInput, dispatcher?: AsyncEnqueuer): Promise<{ event: ProjectEvent; duplicate: boolean; queued: boolean }> {
  const event = gatewayEvent(context, input);
  recordCapture('received', event.id, input.timestamp);
  recordCapture('normalized', event.id, input.timestamp);
  const existing = await repository.listProjectEvents(event, event.projectId);
  const duplicate = existing.find((candidate) => candidate.id === event.id);
  if (duplicate) return { event: duplicate, duplicate: true, queued: false };
  const persisted = await repository.appendProjectEventNextSequence(event);
  recordCapture('persisted', persisted.id, input.timestamp);
  if (!dispatcher) return { event: persisted, duplicate: false, queued: false };
  const queued = dispatcher.enqueueAsync ? await dispatcher.enqueueAsync(persisted) : dispatcher.enqueue(persisted);
  if (queued) recordCapture('queued', persisted.id, input.timestamp);
  else recordCapture('failed', persisted.id, input.timestamp);
  return { event: persisted, duplicate: false, queued };
}
