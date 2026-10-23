import type { MemoryScope } from '../contracts';
import { ScopeError } from '../errors';
import type { Permission, Principal } from './principal';

export const authorize = (principal: Principal, permission: Permission, scope: MemoryScope & Readonly<{ projectId?: string }>): void => {
  if (principal.tenantId !== scope.tenantId || (principal.bankId && principal.bankId !== scope.bankId) || (principal.projectId && principal.projectId !== scope.projectId) || !scope.bankId) throw new ScopeError('scope does not match principal');
  if (!principal.scopes.has(permission)) throw new ScopeError(`missing permission: ${permission}`);
};

export const authorizeProject = (principal: Principal, scope: MemoryScope & { readonly projectId: string }): void => {
  if (!scope.projectId || !principal.allowedProjectIds.includes(scope.projectId)) throw new ScopeError('project is not permitted');
};
