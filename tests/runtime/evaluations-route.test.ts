import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/evaluations/route';

describe('project evaluation API', () => {
  it('requires authentication before reading evaluation evidence', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/evaluations?tenantId=t1&bankId=b1&projectId=p1'));
    expect(response.status).toBe(401);
  });
});
