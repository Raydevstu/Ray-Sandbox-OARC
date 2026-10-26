import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/events/route';

describe('project events API', () => {
  it('requires authentication before reading scoped events', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/events?tenantId=t1&bankId=b1&projectId=p1'));
    expect(response.status).toBe(401);
  });
});
