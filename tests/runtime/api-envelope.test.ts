import { describe, expect, it } from 'vitest';
import { apiFailure, apiSuccess } from '../../lib/runtime/api-envelope';

describe('canonical workflow API envelope', () => {
  it('keeps successful workflow context together', async () => {
    const response = apiSuccess('request-1', { accepted: true }, { workflowRunId: 'workflow-1', state: 'queued', trace: { traceId: 'trace-1' } }, 202);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, requestId: 'request-1', workflowRunId: 'workflow-1', state: 'queued', data: { accepted: true }, trace: { traceId: 'trace-1' } });
  });

  it('keeps retryability explicit on failures', async () => {
    const response = apiFailure('request-2', 'canonical store is unavailable', 'unavailable', 503, { workflowRunId: 'workflow-2', retryable: true });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, requestId: 'request-2', workflowRunId: 'workflow-2', state: 'unavailable', error: 'canonical store is unavailable', retryable: true });
  });
});
