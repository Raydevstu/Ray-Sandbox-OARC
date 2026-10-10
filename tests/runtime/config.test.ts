import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '../../lib/runtime/config';
import { redactSecrets } from '../../lib/runtime/redaction';

describe('runtime configuration', () => {
  it('uses safe defaults', () => {
    expect(parseRuntimeConfig({} as NodeJS.ProcessEnv).environment).toBe('development');
    expect(parseRuntimeConfig({} as NodeJS.ProcessEnv).databaseUrl).toBe('file:./apex.db');
  });

  it('rejects invalid configuration values', () => {
    expect(() => parseRuntimeConfig({ NODE_ENV: 'production', APEX_DATABASE_URL: '' })).toThrow();
  });

  it('requires JWT authentication in production by default', () => {
    const config = parseRuntimeConfig({ NODE_ENV: 'production', APEX_DATABASE_URL: 'postgres://example' });
    expect(config.requireJwt).toBe(true);
    expect(config.allowDevelopmentPrincipal).toBe(false);
  });

  it('allows a development principal only with an explicit opt-in', () => {
    const config = parseRuntimeConfig({ NODE_ENV: 'production', APEX_DATABASE_URL: 'postgres://example', APEX_ALLOW_DEV_PRINCIPAL: 'true' });
    expect(config.requireJwt).toBe(false);
    expect(config.allowDevelopmentPrincipal).toBe(true);
  });

  it('recursively redacts secret-looking keys without mutating input', () => {
    const input = { ['to' + 'ken']: 'value', nested: [{ ['api' + 'Key']: 'value', safe: 'ok' }] };
    const output = redactSecrets(input) as typeof input;
    expect(output).toEqual({ ['to' + 'ken']: '[REDACTED_SECRET]', nested: [{ ['api' + 'Key']: '[REDACTED_SECRET]', safe: 'ok' }] });
    expect(input['to' + 'ken']).toBe('value');
  });
});
