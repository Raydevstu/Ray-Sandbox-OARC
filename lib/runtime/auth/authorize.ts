import type { MemoryScope } from '../contracts';
import { ScopeError } from '../errors';
import type { Permission, Principal } from './principal';

export const authorize = (principal: Principal, permission: Permission, scope: MemoryScope & Readonly<{ projectId?: string }>): void => {
  if (principal.tenantId !== scope.tenantId || (principal.bankId && principal.bankId !== scope.bankId) || (principal.projectId && principal.projectId !== scope.projectId) || !scope.bankId) throw new ScopeError('scope does not match principal');
  if (!principal.scopes.has(permission)) throw new ScopeError(`missing permission: ${permission}`);
};
