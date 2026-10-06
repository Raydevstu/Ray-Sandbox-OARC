import { createPublicKey, verify } from 'node:crypto';
import type { RuntimeConfig } from '../config';
import type { Permission, Principal } from './principal';

type JwtClaims = { sub?: string; tenant_id?: string; tenantId?: string; scope?: string; scopes?: string[]; iss?: string; aud?: string | string[]; exp?: number };
type Jwk = { kid?: string; kty: string; n?: string; e?: string; alg?: string };
type Jwks = { keys: Jwk[] };

const decode = (value: string): Uint8Array => Uint8Array.from(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4), 'base64'));
const claim = (token: string): { header: { kid?: string; alg?: string }; payload: JwtClaims; signingInput: string; signature: Uint8Array } => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid bearer token');
  return { header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()), payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()), signingInput: `${parts[0]}.${parts[1]}`, signature: decode(parts[2]) };
};
const keyFromJwk = (jwk: Jwk) => createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });

export const authenticateJwt = async (token: string, config: RuntimeConfig): Promise<Principal> => {
  if (!config.jwksUrl || !config.jwtIssuer) throw new Error('JWT authentication is not configured');
  const parsed = claim(token);
  if (parsed.header.alg !== 'RS256') throw new Error('unsupported JWT algorithm');
  const claims = parsed.payload;
  if (claims.iss !== config.jwtIssuer || (claims.exp !== undefined && claims.exp <= Math.floor(Date.now() / 1000))) throw new Error('invalid JWT claims');
  const response = await fetch(config.jwksUrl);
  if (!response.ok) throw new Error('unable to load JWKS');
  const keys = (await response.json()) as Jwks;
  const jwk = keys.keys.find((key) => key.kid === parsed.header.kid);
  if (!jwk || !verify('RSA-SHA256', Buffer.from(parsed.signingInput), keyFromJwk(jwk), Buffer.from(parsed.signature))) throw new Error('invalid JWT signature');
  const tenantId = claims.tenant_id ?? claims.tenantId;
  if (!claims.sub || !tenantId) throw new Error('JWT is missing subject or tenant');
  const scopes = claims.scopes ?? claims.scope?.split(/\s+/) ?? [];
  return { subject: claims.sub, tenantId, scopes: new Set(scopes as Permission[]), source: 'jwt' };
};
