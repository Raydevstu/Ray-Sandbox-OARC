import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../app/api/runtime-metrics/route';
import { runtimeMetrics } from '../../lib/runtime/live-metrics';

describe('runtime metrics route', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns aggregate local observations without exposing request contents', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    runtimeMetrics.record({ operation: 'recall', durationMs: 17, outcome: 'success' });

    const response = await GET(new Request('http://localhost/api/runtime-metrics'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ operations: { recall: expect.any(Number) }, successes: expect.any(Number) });
  });

  it('opens a snapshot SSE stream during local development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const response = await GET(new Request('http://localhost/api/runtime-metrics?stream=1'));
    const first = await response.body?.getReader().read();

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(new TextDecoder().decode(first?.value)).toContain('event: snapshot');
  });

  it('fails closed outside local development', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await GET(new Request('http://localhost/api/runtime-metrics'));

    expect(response.status).toBe(404);
  });
});
