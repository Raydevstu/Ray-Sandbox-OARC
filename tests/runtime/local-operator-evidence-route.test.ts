import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/local/operator/evidence/route';

describe('local operator evidence route', () => {
  it('does not expose durable evidence without the server-issued session', async () => {
    const response = await GET(new Request('http://local/api/local/operator/evidence'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, state: 'unauthorized' });
  });
});
