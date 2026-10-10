import { randomUUID } from 'node:crypto';
import type { Principal } from '../auth';

type McpSession = Readonly<{ id: string; principal: Principal; createdAt: number; lastSeenAt: number }>;

const sessions = new Map<string, McpSession>();

export const createMcpSession = (principal: Principal): string => {
  const id = randomUUID();
  const now = Date.now();
  sessions.set(id, { id, principal, createdAt: now, lastSeenAt: now });
  return id;
};

export const touchMcpSession = (id: string): McpSession | undefined => {
  const session = sessions.get(id);
  if (!session) return undefined;
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
