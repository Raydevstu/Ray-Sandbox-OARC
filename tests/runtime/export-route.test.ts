import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/export/route';

describe('project memory export API', () => {
  it('requires authentication before exporting a manifest', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/export?tenantId=t1&bankId=b1&projectId=p1'));
    expect(response.status).toBe(401);
  });

  it('rejects an export without a complete project scope', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/export?tenantId=t1&bankId=b1', { headers: { 'x-dev-subject': 'operator', 'x-dev-tenant-id': 't1', 'x-dev-scopes': 'memory:read' } }));
    expect(response.status).toBe(400);
  });
});
