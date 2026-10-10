import { RuntimeConfigError } from './errors';

export type RuntimeConfig = Readonly<{ environment: 'development' | 'test' | 'production'; databaseUrl: string; logLevel: 'debug' | 'info' | 'warn' | 'error'; jwtIssuer?: string; jwksUrl?: string; allowDevelopmentPrincipal: boolean; requireJwt: boolean }>;
export function parseRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const environment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment)) throw new RuntimeConfigError(`Invalid NODE_ENV: ${environment}`);
  const databaseUrl = env.APEX_DATABASE_URL ?? 'file:./apex.db';
  if (!databaseUrl.trim()) throw new RuntimeConfigError('APEX_DATABASE_URL must not be empty');
  const logLevel = env.APEX_LOG_LEVEL ?? 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) throw new RuntimeConfigError(`Invalid APEX_LOG_LEVEL: ${logLevel}`);
  const requireJwt = env.APEX_REQUIRE_JWT === 'true' || environment === 'production' && env.APEX_ALLOW_DEV_PRINCIPAL !== 'true';
  return { environment: environment as RuntimeConfig['environment'], databaseUrl, logLevel: logLevel as RuntimeConfig['logLevel'], jwtIssuer: env.APEX_JWT_ISSUER, jwksUrl: env.APEX_JWKS_URL, allowDevelopmentPrincipal: !requireJwt && (env.APEX_ALLOW_DEV_PRINCIPAL === 'true' || environment === 'test'), requireJwt };
}
