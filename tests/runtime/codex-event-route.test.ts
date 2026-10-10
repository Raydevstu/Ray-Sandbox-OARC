import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/project-memory/codex-event/route';

describe('Codex event hook', () => {
  it('requires authentication before accepting event payloads', async () => {
    const response = await POST(new Request('http://localhost/api/project-memory/codex-event', { method: 'POST', body: JSON.stringify({ tenantId: 't1', bankId: 'b1', projectId: 'p1', conversationId: 'c1', messageId: 'm1', timestamp: '2026-10-08T00:00:00.000Z', kind: 'mcp-call', method: 'tools/call', name: 'memory_recall' }), headers: { 'content-type': 'application/json' } }));
    expect(response.status).toBe(401);
  });
});
