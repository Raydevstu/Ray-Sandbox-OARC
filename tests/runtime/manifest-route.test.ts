import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/manifest/route';

describe('project manifest API', () => {
  it('requires authentication before reading a manifest', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/manifest?tenantId=t1&bankId=b1&projectId=p1'));
    expect(response.status).toBe(401);
  });
});
