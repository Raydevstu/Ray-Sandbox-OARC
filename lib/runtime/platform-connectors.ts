import type { ImportEnvelope, ImportPlatform } from './cross-platform-import';

export type ConnectorMessage = Readonly<{ id?: string; uuid?: string; role?: string; author?: string; sender?: string; content?: unknown; text?: string; timestamp?: string; createdAt?: string; [key: string]: unknown }>;
export type ConnectorInput = Readonly<{ platform: ImportPlatform; conversationId: string; exportedAt?: string; sourceReference: string; projectId?: string; workspaceId?: string; workspacePath?: string; messages: readonly ConnectorMessage[] }>;

const allowedPlatforms = new Set<ImportPlatform>(['codex', 'hermes', 'openai-api']);
const now = () => new Date().toISOString();

/** Shared adapter boundary for Codex, Hermes, and OpenAI host connectors. */
export const createPlatformImportEnvelope = (input: ConnectorInput): ImportEnvelope => {
  if (!allowedPlatforms.has(input.platform)) throw new Error(`platform connector not enabled: ${input.platform}`);
  if (!input.conversationId.trim() || !input.sourceReference.trim()) throw new Error('conversationId and sourceReference are required');
  if (!input.projectId?.trim() && !input.workspaceId?.trim()) throw new Error('projectId or workspaceId is required');
  if (!input.messages.length) throw new Error('at least one message is required');
  return { ...input, exportedAt: input.exportedAt ?? now(), messages: input.messages };
};

export const createCodexImport = (input: Omit<ConnectorInput, 'platform'>): ImportEnvelope => createPlatformImportEnvelope({ ...input, platform: 'codex' });
export const createHermesImport = (input: Omit<ConnectorInput, 'platform'>): ImportEnvelope => createPlatformImportEnvelope({ ...input, platform: 'hermes' });
export const createOpenAIImport = (input: Omit<ConnectorInput, 'platform'>): ImportEnvelope => createPlatformImportEnvelope({ ...input, platform: 'openai-api' });
