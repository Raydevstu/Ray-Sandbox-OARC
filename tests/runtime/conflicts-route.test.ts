import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/conflicts/route';

describe('project conflict API', () => {
  it('requires authentication before reading conflicts', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/conflicts?tenantId=t1&bankId=b1&projectId=p1'));
    expect(response.status).toBe(401);
  });
});
