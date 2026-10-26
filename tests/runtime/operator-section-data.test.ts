import { describe, expect, it } from 'vitest';
import { loadAuthenticatedOperatorSectionData, loadOperatorSectionData } from '../../lib/runtime/operator-section-data';

describe('operator section data', () => {
  it('does not manufacture authenticated staging scope for an anonymous operator page', () => {
    expect(loadOperatorSectionData('events')).toEqual({
      endpoint: '/api/project-memory/events',
      state: 'unauthorized',
      summary: 'Sign in with a project-scoped operator identity to inspect durable data.',
    });
  });

  it('reports the supplied route state without exposing route payloads', () => {
    expect(loadOperatorSectionData('conflicts', 'empty')).toEqual({
      endpoint: '/api/project-memory/conflicts',
      state: 'empty',
      summary: 'No durable conflicts are available in the authenticated project scope.',
    });
  });

  it('forwards only authenticated request headers and the explicit project scope to a protected route', async () => {
    const fetcher = async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/project-memory/events?tenantId=t1&bankId=b1&projectId=p1');
      expect(new Headers(init?.headers).get('x-dev-subject')).toBe('operator');
      return new Response(JSON.stringify({ ok: true, data: { events: [{ id: 'event-1' }] } }), { status: 200 });
    };

    await expect(loadAuthenticatedOperatorSectionData('events', { tenantId: 't1', bankId: 'b1', projectId: 'p1' }, { 'x-dev-subject': 'operator' }, fetcher)).resolves.toMatchObject({ state: 'healthy', count: 1 });
  });
});
