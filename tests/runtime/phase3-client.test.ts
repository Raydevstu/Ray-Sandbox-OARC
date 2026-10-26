import { expect, it, vi } from 'vitest';
import { postPhase3Step } from '../../lib/runtime/phase3-client';

it('posts a scoped phase 3 step and preserves the workflow envelope', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, requestId: 'r1', state: 'healthy', data: { step: 'learn' } }), { status: 201 }));
  await expect(postPhase3Step('learn', { tenantId: 't', bankId: 'b', projectId: 'p', workflowRunId: 'w' }, { payload: 'x' }, fetcher)).resolves.toMatchObject({ ok: true, data: { step: 'learn' } });
});
