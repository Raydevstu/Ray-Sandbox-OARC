import type { RuntimeConfig } from '../config';
import { ScopeError } from '../errors';
import type { MemoryScope } from '../contracts';

export type Permission = 'memory:read' | 'memory:write' | 'events:write' | 'jobs:claim' | 'snapshots:write';
export type Principal = Readonly<{ subject: string; tenantId: string; bankId?: string; projectId?: string; scopes: ReadonlySet<Permission>; allowedProjectIds: readonly string[]; source: 'jwt' | 'dev' | 'service' }>;

export const developmentPrincipal = (config: RuntimeConfig, request: Request): Principal => {
  // Production remains locked down by default. An explicitly supplied
  // APEX_ALLOW_DEV_PRINCIPAL=true is the opt-in for isolated local verification.
  if (!config.allowDevelopmentPrincipal) throw new Error('development principal is disabled');
  const subject = request.headers.get('x-dev-subject');
  const tenantId = request.headers.get('x-dev-tenant-id');
  const bankId = request.headers.get('x-dev-bank-id') ?? undefined;
  const projectId = request.headers.get('x-dev-project-id') ?? undefined;
  const scopes = request.headers.get('x-dev-scopes')?.split(/\s+/).filter(Boolean) as Permission[] | undefined;
  const allowedProjectIds = request.headers.get('x-dev-allowed-project-ids')?.split(/\s*,\s*/).map((projectId) => projectId.trim()).filter(Boolean) ?? [];
  if (!subject || !tenantId || !scopes?.length) throw new Error('development principal requires subject, tenant, and scopes');
  return { subject, tenantId, bankId, projectId, scopes: new Set(scopes), allowedProjectIds, source: 'dev' };
};
