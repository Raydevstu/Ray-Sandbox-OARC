import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/project-memory/proposals/route';

describe('proposal review API', () => {
  it('rejects unauthenticated proposal review before evaluating candidate content', async () => {
    const response = await POST(new Request('http://localhost/api/project-memory/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenantId: 't1', bankId: 'b1', projectId: 'p1', candidate: { record: {} }, policy: {} }) }));
    expect(response.status).toBe(401);
  });
});
