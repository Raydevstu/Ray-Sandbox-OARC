import { randomUUID } from 'node:crypto';
import type { Principal } from '../auth';

export type McpConnectorContext = Readonly<{
  provider: 'hermes' | 'opencode';
  agentId: string;
  tenantId: string;
  bankId: string;
  projectId: string;
  conversationId?: string;
  runId?: string;
}>;

export type McpSession = Readonly<{ id: string; principal: Principal; context: McpConnectorContext; createdAt: number; lastSeenAt: number }>;

const sessions = new Map<string, McpSession>();

export const createMcpSession = (principal: Principal, context: McpConnectorContext): string => {
  const id = randomUUID();
  const now = Date.now();
  sessions.set(id, { id, principal, context, createdAt: now, lastSeenAt: now });
  return id;
};

export const touchMcpSession = (id: string, principal: Principal): McpSession | undefined => {
  const session = sessions.get(id);
  if (!session || session.principal.subject !== principal.subject || session.principal.tenantId !== principal.tenantId) return undefined;
  const touched = { ...session, lastSeenAt: Date.now() };
  sessions.set(id, touched);
  return touched;
};

export const deleteMcpSession = (id: string): void => {
  sessions.delete(id);
};

export const clearMcpSessions = (): void => {
  sessions.clear();
};
