import type { RuntimeConfig } from '../config';
import { developmentPrincipal } from './principal';
import type { Principal } from './principal';
import { authenticateJwt } from './jwks';
import { readLocalOperatorSession } from '../local-operator';

export const authenticateRequest = async (request: Request, config: RuntimeConfig): Promise<Principal> => {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authenticateJwt(authorization.slice(7), config);
  const sessionToken = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('oarc_dashboard_session='))?.slice('oarc_dashboard_session='.length);
  if (sessionToken === 'local-owner' && config.allowDevelopmentPrincipal) return { subject: 'local-owner', tenantId: 'demo-tenant', scopes: new Set(['memory:read']), allowedProjectIds: config.developmentProjectIds, source: 'dev' };
  if (sessionToken) return authenticateJwt(decodeURIComponent(sessionToken), config);
  if (config.requireJwt) throw new Error('JWT authentication is required');
  const localSession = readLocalOperatorSession(config, request);
  if (localSession) return localSession;
  if (request.headers.has('x-dev-subject')) return developmentPrincipal(config, request);
  throw new Error('missing credentials');
};

export { authorize, authorizeProject } from './authorize';
export type { Permission, Principal } from './principal';
