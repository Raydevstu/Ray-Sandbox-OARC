import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/graph/route';

describe('typed graph API', () => {
  it('requires authentication before graph traversal', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/graph?label=alice&at=2026-10-10T00:00:00.000Z'));
    expect(response.status).toBe(401);
  });

  it('rejects malformed temporal graph queries after authentication', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/graph?label=alice&at=not-a-date', { headers: { 'x-dev-subject': 'operator' } }));
    expect(response.status).toBe(400);
  });
});
