import { describe, expect, it } from 'vitest';
import { GET, POST } from '../../app/api/project-memory/policies/route';

describe('memory policy API', () => {
  it('requires authentication for reads and writes', async () => {
    const url = 'http://localhost/api/project-memory/policies?tenantId=t1&bankId=b1&projectId=p1';
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await POST(new Request(url, { method: 'POST', body: JSON.stringify({ tenantId: 't1', bankId: 'b1', projectId: 'p1', policy: {} }) }))).status).toBe(401);
  });
});
