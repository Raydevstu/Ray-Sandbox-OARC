import { describe, expect, it } from 'vitest';

import { buildRuntimeTruth } from '../../lib/runtime/runtime-truth';

describe('runtime truth contract', () => {
  it('reports only non-secret runtime identity and evidence boundaries', () => {
    expect(buildRuntimeTruth({
      environment: 'development',
      allowDevelopmentPrincipal: true,
      requireJwt: false,
      canonicalStore: 'healthy',
      buildId: 'abc123',
    })).toEqual({
      environment: 'development',
      authMode: 'development-principal',
      canonicalStore: 'healthy',
      buildId: 'abc123',
      evidence: 'local',
    });
  });

  it('never represents a production runtime as locally verified', () => {
    expect(buildRuntimeTruth({
      environment: 'production',
      allowDevelopmentPrincipal: false,
      requireJwt: true,
      canonicalStore: 'unavailable',
      buildId: null,
    })).toMatchObject({
      environment: 'production',
      authMode: 'jwt-required',
      canonicalStore: 'unavailable',
      buildId: 'unknown',
      evidence: 'not-verified',
    });
  });
});
