import type { RuntimeConfig } from '../config';
import { developmentPrincipal } from './principal';
import type { Principal } from './principal';
import { authenticateJwt } from './jwks';

export const authenticateRequest = async (request: Request, config: RuntimeConfig): Promise<Principal> => {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authenticateJwt(authorization.slice(7), config);
  if (config.requireJwt) throw new Error('JWT authentication is required');
  if (request.headers.has('x-dev-subject')) return developmentPrincipal(config, request);
  throw new Error('missing credentials');
};

export { authorize } from './authorize';
export type { Permission, Principal } from './principal';
