import { describe, expect, it, vi } from 'vitest';
import { savePromptVersion } from '../../lib/runtime/prompt-client';

it('preserves the canonical prompt envelope', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, requestId: 'r1', state: 'healthy', data: { promptId: 'p', version: 1 } }), { status: 201 }));
  await expect(savePromptVersion({ tenantId: 't', bankId: 'b', projectId: 'p1' }, { promptId: 'p', version: 1, content: '{}' }, fetcher)).resolves.toMatchObject({ ok: true, requestId: 'r1' });
});
