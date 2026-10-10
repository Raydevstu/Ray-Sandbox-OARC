import { stableId } from './contracts';
import type { ConversationEvent, MemoryScope, ProjectEvent } from './contracts';
import type { CanonicalRepository } from './repositories/interfaces';
import type { AsyncProjectMemoryEnqueuer, ProjectMemoryEnqueuer } from './project-memory-dispatch';
import { dispatchProjectMemory } from './project-memory-dispatch';

export type CodexConnectorMetadata = Readonly<{ projectId: string; conversationId: string; sessionId?: string; timestamp: string }>;
export type CodexMcpCall = Readonly<{ messageId: string; method: string; name?: string; arguments?: Readonly<Record<string, unknown>>; role?: 'user' | 'assistant' | 'tool' | 'system'; content?: string; timestamp?: string }>;
export type CodexToolResult = Readonly<{ messageId: string; toolCallId?: string; name: string; result: unknown; timestamp?: string }>;
export type CodexProjectSession = Readonly<{ sessionId: string; branch?: string; workspace?: string; runtime?: string; startedAt: string; metadata?: Readonly<Record<string, unknown>> }>;

const requireMetadata = (metadata: CodexConnectorMetadata): CodexConnectorMetadata => {
  if (!metadata.projectId.trim() || !metadata.conversationId.trim() || !metadata.timestamp) throw new Error('missing Codex connector metadata');
  return metadata;
};
const eventId = (scope: MemoryScope, projectId: string, kind: string, sourceId: string): string => stableId('codex', scope.tenantId, scope.bankId, projectId, kind, sourceId);
const base = (scope: MemoryScope, metadata: CodexConnectorMetadata, id: string, type: string, payload: Readonly<Record<string, unknown>>, occurredAt = metadata.timestamp): ProjectEvent => ({ ...scope, id, projectId: metadata.projectId, type, payload, occurredAt, sequence: 0 });

export const normalizeCodexMcpCall = (scope: MemoryScope, metadata: CodexConnectorMetadata, call: CodexMcpCall): ConversationEvent => {
  requireMetadata(metadata);
  if (!call.messageId.trim() || !call.method.trim()) throw new Error('missing Codex MCP call metadata');
  return { ...scope, projectId: metadata.projectId, platform: 'codex', conversationId: metadata.conversationId, messageId: call.messageId, role: call.role ?? 'tool', content: call.content ?? `${call.method}${call.name ? ` ${call.name}` : ''}`, timestamp: call.timestamp ?? metadata.timestamp, toolCalls: [{ method: call.method, name: call.name, arguments: call.arguments }] };
};

export const normalizeCodexToolResult = (scope: MemoryScope, metadata: CodexConnectorMetadata, result: CodexToolResult): ConversationEvent => {
  requireMetadata(metadata);
  if (!result.messageId.trim() || !result.name.trim()) throw new Error('missing Codex tool-result metadata');
  return { ...scope, projectId: metadata.projectId, platform: 'codex', conversationId: metadata.conversationId, messageId: result.messageId, role: 'tool', content: JSON.stringify(result.result), timestamp: result.timestamp ?? metadata.timestamp, toolCalls: [{ toolCallId: result.toolCallId, name: result.name }] };
};

export const normalizeCodexProjectSession = (scope: MemoryScope, metadata: CodexConnectorMetadata, session: CodexProjectSession): ProjectEvent => {
  requireMetadata(metadata);
  if (!session.sessionId.trim()) throw new Error('missing Codex session metadata');
  return base(scope, metadata, eventId(scope, metadata.projectId, 'session', session.sessionId), 'CodexProjectSessionStarted', { platform: 'codex', session, source: { platform: 'codex', conversationId: metadata.conversationId, timestamp: session.startedAt } }, session.startedAt);
};

export const normalizeCodexMcpEvent = (scope: MemoryScope, metadata: CodexConnectorMetadata, call: CodexMcpCall): ProjectEvent => {
  const conversation = normalizeCodexMcpCall(scope, metadata, call);
  return base(scope, metadata, eventId(scope, metadata.projectId, 'mcp', call.messageId), 'CodexConversationEvent', { conversation, source: { platform: 'codex', conversationId: metadata.conversationId, messageId: call.messageId, timestamp: conversation.timestamp } }, conversation.timestamp);
};
export const normalizeCodexToolEvent = (scope: MemoryScope, metadata: CodexConnectorMetadata, result: CodexToolResult): ProjectEvent => {
  const conversation = normalizeCodexToolResult(scope, metadata, result);
  return base(scope, metadata, eventId(scope, metadata.projectId, 'tool', result.messageId), 'CodexToolResult', { conversation, source: { platform: 'codex', conversationId: metadata.conversationId, messageId: result.messageId, timestamp: conversation.timestamp } }, conversation.timestamp);
};

export const persistCodexProjectEvent = async (repository: CanonicalRepository, event: ProjectEvent, dispatcher?: ProjectMemoryEnqueuer): Promise<{ event: ProjectEvent; duplicate: boolean; queued: boolean }> => {
  const existing = await repository.listProjectEvents(event, event.projectId);
  const duplicate = existing.some((candidate) => candidate.id === event.id);
  if (duplicate) return { event: existing.find((candidate) => candidate.id === event.id) ?? event, duplicate: true, queued: false };
  const sequence = existing.reduce((max, candidate) => Math.max(max, candidate.sequence), 0) + 1;
  const persisted = { ...event, sequence };
  await repository.appendProjectEvent(persisted);
  const queued = dispatcher && 'enqueueAsync' in dispatcher
    ? await (dispatcher as AsyncProjectMemoryEnqueuer).enqueueAsync(persisted)
    : dispatchProjectMemory(dispatcher, persisted);
  return { event: persisted, duplicate: false, queued };
};
