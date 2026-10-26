import { stableId } from './contracts';
import type { ConversationEvent, MemoryScope, ProjectEvent } from './contracts';

export type ImportPlatform = 'codex' | 'hermes' | 'openai-api' | 'chatgpt' | 'claude' | 'gemini' | 'cursor' | 'terminal' | 'opencode' | 'vscode';
export type ImportEnvelope = Readonly<{ projectId?: string; workspaceId?: string; workspacePath?: string; platform: ImportPlatform; conversationId: string; exportedAt: string; sourceReference: string; messages: readonly Readonly<Record<string, unknown>>[] }>;
export type CaptureGap = Readonly<{ platform: ImportPlatform; projectId: string; reason: 'export_unavailable' | 'connector_unavailable' | 'invalid_export'; sourceReference?: string }>;
export type ImportResult = Readonly<{ events: readonly ProjectEvent[]; gaps: readonly CaptureGap[] }>;

const asString = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
const roleOf = (value: unknown): ConversationEvent['role'] => value === 'user' || value === 'assistant' || value === 'tool' || value === 'system' ? value : 'assistant';
const contentOf = (message: Readonly<Record<string, unknown>>): string | undefined => asString(message.content) ?? asString(message.text) ?? (message.content && typeof message.content === 'object' ? asString((message.content as Record<string, unknown>).text) : undefined);
const messageIdOf = (message: Readonly<Record<string, unknown>>, index: number): string => asString(message.id) ?? asString(message.uuid) ?? `message-${index + 1}`;
const timestampOf = (message: Readonly<Record<string, unknown>>, fallback: string): string => asString(message.timestamp) ?? asString(message.createdAt) ?? fallback;

export const normalizeImportedConversation = (scope: MemoryScope, input: ImportEnvelope & Readonly<{ projectId: string }>): readonly ConversationEvent[] => input.messages.flatMap((message, index) => {
  const content = contentOf(message);
  if (!content) return [];
  const messageId = messageIdOf(message, index);
  return [{ ...scope, projectId: input.projectId, platform: input.platform, conversationId: input.conversationId, messageId, role: roleOf(message.role ?? message.author ?? message.sender), content, timestamp: timestampOf(message, input.exportedAt), attachments: Array.isArray(message.attachments) ? message.attachments.filter((item): item is string => typeof item === 'string') : undefined, toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : undefined }];
});

export const importConversationExport = (scope: MemoryScope, input: ImportEnvelope): ImportResult => {
  const projectId = input.projectId?.trim() || (input.workspaceId?.trim() ? stableId('project', scope.tenantId, scope.bankId, input.platform, input.workspaceId).slice(0, 24) : '');
  const normalized = { ...input, projectId };
  if (!projectId || !input.conversationId.trim() || !input.sourceReference.trim()) return { events: [], gaps: [{ platform: input.platform, projectId, reason: 'invalid_export', sourceReference: input.sourceReference }] };
  const conversations = normalizeImportedConversation(scope, normalized);
  if (!conversations.length) return { events: [], gaps: [{ platform: input.platform, projectId, reason: 'invalid_export', sourceReference: input.sourceReference }] };
  return { events: conversations.map((conversation) => ({ ...scope, id: stableId('import', scope.tenantId, scope.bankId, input.platform, input.conversationId, conversation.messageId), projectId, type: 'ConversationImported', payload: { conversation, source: { platform: input.platform, reference: input.sourceReference, exportedAt: input.exportedAt, workspaceId: input.workspaceId, workspacePath: input.workspacePath } }, occurredAt: conversation.timestamp, sequence: 0 })), gaps: [] };
};

export const unavailableImport = (platform: ImportPlatform, projectId: string, reason: CaptureGap['reason'] = 'export_unavailable'): ImportResult => ({ events: [], gaps: [{ platform, projectId, reason }] });
