import type { RuntimeConfig } from './config';
import type { RuntimeStoreStatus } from './repository';

export type RuntimeTruth = Readonly<{
  environment: RuntimeConfig['environment'];
  authMode: 'jwt-required' | 'development-principal' | 'session-required';
  canonicalStore: RuntimeStoreStatus;
  buildId: string;
  evidence: 'local' | 'not-verified';
}>;

export function buildRuntimeTruth(input: Readonly<{
  environment: RuntimeConfig['environment'];
  allowDevelopmentPrincipal: boolean;
  requireJwt: boolean;
  canonicalStore: RuntimeStoreStatus;
  buildId: string | null | undefined;
}>): RuntimeTruth {
  return {
    environment: input.environment,
    authMode: input.requireJwt ? 'jwt-required' : input.allowDevelopmentPrincipal ? 'development-principal' : 'session-required',
    canonicalStore: input.canonicalStore,
    buildId: input.buildId?.trim() || 'unknown',
    evidence: input.environment === 'development' || input.environment === 'test' ? 'local' : 'not-verified',
  };
}
