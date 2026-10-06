import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { parseRuntimeConfig } from '../../lib/runtime/config';
import { authenticateRequest } from '../../lib/runtime/auth';
import { authorize } from '../../lib/runtime/auth/authorize';
import { authenticateJwt } from '../../lib/runtime/auth/jwks';

const config = parseRuntimeConfig({ NODE_ENV: 'test' });
const scope = { tenantId: 't1', bankId: 'b1' } as const;

describe('runtime authorization', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('rejects missing credentials', async () => { await expect(authenticateRequest(new Request('http://local'), config)).rejects.toThrow('missing credentials'); });
  it('requires explicit development principal fields', async () => { await expect(authenticateRequest(new Request('http://local', { headers: { 'x-dev-subject': 's' } }), config)).rejects.toThrow(); });
  it('enforces tenant scope and permission', () => {
    const principal = { subject: 's', tenantId: 't1', scopes: new Set(['memory:read' as const]), source: 'dev' as const };
    expect(() => authorize(principal, 'memory:read', scope)).not.toThrow();
    expect(() => authorize(principal, 'memory:write', scope)).toThrow();
    expect(() => authorize(principal, 'memory:read', { tenantId: 't2', bankId: 'b1' })).toThrow();
  });
  it('rejects a JWT with the wrong issuer', async () => {
    const token = `eyJhbGciOiJSUzI1NiIsImtpZCI6ImsxIn0.${Buffer.from(JSON.stringify({ sub: 's', tenant_id: 't1', iss: 'wrong' })).toString('base64url')}.AA`;
    await expect(authenticateJwt(token, { ...config, jwtIssuer: 'expected', jwksUrl: 'http://jwks' })).rejects.toThrow('invalid JWT claims');
  });
  it('rejects an invalid JWT signature', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 's', tenant_id: 't1', iss: 'expected' })).toString('base64url');
    const badSignature = sign('RSA-SHA256', Buffer.from('different'), privateKey).toString('base64url');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1' }] }), { status: 200 })));
    await expect(authenticateJwt(`${header}.${payload}.${badSignature}`, { ...config, jwtIssuer: 'expected', jwksUrl: 'http://jwks' })).rejects.toThrow('invalid JWT signature');
  });
});
