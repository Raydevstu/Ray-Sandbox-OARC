import { describe, expect, it } from 'vitest';
import { assertDeploymentResponse, type DeploymentResponse } from '../../lib/runtime/deployment-gates';

describe('deployment gates', () => {
  it('requires healthy canonical storage for health and readiness', () => {
    const response: DeploymentResponse = {
      health: { ok: true, data: { status: 'ok', components: { api: 'ok', canonicalStore: 'unavailable' } } },
      ready: { ok: false, data: { status: 'unavailable' } },
      healthStatus: 200,
      readyStatus: 503,
      authStatus: 401,
      staticStatus: 200,
      staticHtml: '<script src="/_next/static/chunks/app.js"></script>',
      latencyMs: { health: 10, ready: 11, auth: 12, static: 13 },
    };

    expect(() => assertDeploymentResponse(response, 500)).toThrow('canonical store');
  });

  it('accepts a healthy authenticated production-like response within the latency gate', () => {
    const response: DeploymentResponse = {
      health: { ok: true, data: { status: 'ok', components: { api: 'ok', canonicalStore: 'healthy' } } },
      ready: { ok: true, data: { status: 'ready' } },
      healthStatus: 200,
      readyStatus: 200,
      authStatus: 401,
      staticStatus: 200,
      staticHtml: '<script src="/_next/static/chunks/app.js"></script>',
      latencyMs: { health: 10, ready: 11, auth: 12, static: 13 },
    };

    expect(() => assertDeploymentResponse(response, 500)).not.toThrow();
  });

  it('rejects a slow endpoint even when it returns 200', () => {
    const response: DeploymentResponse = {
      health: { ok: true, data: { status: 'ok', components: { api: 'ok', canonicalStore: 'healthy' } } },
      ready: { ok: true, data: { status: 'ready' } },
      healthStatus: 200,
      readyStatus: 200,
      authStatus: 401,
      staticStatus: 200,
      staticHtml: '<script src="/_next/static/chunks/app.js"></script>',
      latencyMs: { health: 501, ready: 11, auth: 12, static: 13 },
    };

    expect(() => assertDeploymentResponse(response, 500)).toThrow('latency');
  });
});
