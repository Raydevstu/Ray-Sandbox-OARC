import { describe, expect, it } from 'vitest';
import { createJob, retryJob } from '../../lib/runtime/jobs';
import { rebuildProjection } from '../../lib/runtime/projections';

describe('runtime jobs and rebuilds', () => {
  it('creates bounded retryable jobs and dead letters at the limit', () => {
    const event = { tenantId: 't1', bankId: 'b1', id: 'e1', type: 'MemoryRetained', payload: {}, occurredAt: '2026-10-06T00:00:00.000Z' };
    const job = createJob(event);
    expect(retryJob(retryJob(job, 2), 2).status).toBe('dead-letter');
  });
  it('rejects cross-scope projection rebuilds', async () => {
    await expect(rebuildProjection({ tenantId: 't1', bankId: 'b1' }, 'lexical', [{ tenantId: 't2', bankId: 'b1' }])).rejects.toThrow('scope');
  });
});
