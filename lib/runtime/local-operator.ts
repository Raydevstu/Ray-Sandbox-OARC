import { randomUUID } from 'node:crypto';
import type { RuntimeConfig } from './config';
import type { Permission, Principal } from './auth/principal';

export const LOCAL_OPERATOR_COOKIE = 'oarc_local_operator';

export type LocalOperatorScope = Readonly<{ id: string; label: string; tenantId: string; bankId: string; projectId: string }>;
export type LocalOperatorSession = Principal & Readonly<{ scopeId: string; label: string }>;

const stagingScope: LocalOperatorScope =
  { id: 'staging', label: 'Local PostgreSQL staging', tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: 'staging-project' };
const scopesFor = (config: RuntimeConfig): readonly LocalOperatorScope[] => config.auditScope ? [{ id: 'configured', label: config.auditScope.label ?? 'Configured project scope', ...config.auditScope }] : [stagingScope];
type StoredSession = LocalOperatorSession & Readonly<{ expiresAt: number }>;
type LocalOperatorGlobal = typeof globalThis & { __oarcLocalOperatorSessions?: Map<string, StoredSession> };
const localOperatorGlobal = globalThis as LocalOperatorGlobal;
const sessions = localOperatorGlobal.__oarcLocalOperatorSessions ?? new Map<string, StoredSession>();
localOperatorGlobal.__oarcLocalOperatorSessions = sessions;
const sessionPermissions = new Set<Permission>(['memory:read']);
const sessionLifetimeMs = 8 * 60 * 60 * 1000;

export const isLocalOperatorBridgeEnabled = (config: RuntimeConfig): boolean => config.environment !== 'production' && config.allowDevelopmentPrincipal;

export const listLocalOperatorScopes = (config: RuntimeConfig): readonly LocalOperatorScope[] => isLocalOperatorBridgeEnabled(config) ? scopesFor(config) : [];

const tokenFromCookie = (value: string | null): string | undefined => value?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${LOCAL_OPERATOR_COOKIE}=`))?.slice(LOCAL_OPERATOR_COOKIE.length + 1);

export const createLocalOperatorSession = (config: RuntimeConfig, scopeId: string): { token: string; cookie: string; scope: LocalOperatorScope } => {
  if (!isLocalOperatorBridgeEnabled(config)) throw new Error('local operator bridge is disabled');
  const scope = scopesFor(config).find((candidate) => candidate.id === scopeId);
  if (!scope) throw new Error('unknown local operator scope');
  const token = randomUUID();
  sessions.set(token, { subject: 'local-operator', tenantId: scope.tenantId, bankId: scope.bankId, projectId: scope.projectId, scopes: sessionPermissions, allowedProjectIds: [scope.projectId], source: 'dev', scopeId: scope.id, label: scope.label, expiresAt: Date.now() + sessionLifetimeMs });
  return { token, cookie: `${LOCAL_OPERATOR_COOKIE}=${token}`, scope };
};

export const readLocalOperatorSession = (config: RuntimeConfig, request: Request): LocalOperatorSession | null => {
  if (!isLocalOperatorBridgeEnabled(config)) return null;
  const token = tokenFromCookie(request.headers.get('cookie'));
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  const { expiresAt: _expiresAt, ...principal } = session;
  return principal;
};

export const destroyLocalOperatorSession = (cookieOrToken: string): void => {
  sessions.delete(tokenFromCookie(cookieOrToken) ?? cookieOrToken);
};
