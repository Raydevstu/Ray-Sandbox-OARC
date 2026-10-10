import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/project-memory/trace/route';

describe('memory trace API', () => {
  it('requires authentication', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/trace?projectId=p1&query=postgres'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it('rejects missing query input after authentication', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/trace?projectId=p1', { headers: { 'x-dev-subject': 'operator' } }));
    expect(response.status).toBe(400);
  });

  it('keeps graph data behind the authenticated trace boundary', async () => {
    const response = await GET(new Request('http://localhost/api/project-memory/trace?projectId=p1&query=postgres', { headers: { 'x-dev-subject': 'operator' } }));
    expect([400, 503]).toContain(response.status);
  });
});
