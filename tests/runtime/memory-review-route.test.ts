import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/project-memory/review/route';

describe('memory review API', () => {
  it('requires authentication before accepting review actions', async () => {
    const response = await POST(new Request('http://localhost/api/project-memory/review', { method: 'POST', body: JSON.stringify({ tenantId: 't1', bankId: 'b1', projectId: 'p1', recordId: 'r1', action: 'invalidate', reason: 'review' }), headers: { 'content-type': 'application/json' } }));
    expect(response.status).toBe(401);
  });
});
