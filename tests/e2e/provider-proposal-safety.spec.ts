import { expect, test } from '@playwright/test';

const policy = { policyId: 'browser-proposal-policy', version: 1, scope: {}, retentionDays: 30, minimumConfidence: 0.8, approvalRequiredFor: [], connectorAllowlist: ['gemini'], model: { provider: 'local', model: 'deterministic', maxCostUsd: 0 }, explainability: { required: true, includeSource: true, includeRationale: true } };

test('authenticated rejected provider proposal remains proposal-only', async ({ request }) => {
  const response = await request.post('/api/project-memory/proposals', { data: { tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: 'staging-project', candidate: { sourceEventId: 'untrusted', record: {} }, policy } });
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ ok: true, data: { disposition: 'deny', canonicalWrites: 0 } });
});
