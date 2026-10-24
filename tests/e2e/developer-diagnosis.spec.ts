import { expect, test } from '@playwright/test';

test('authenticated developer completes the project-scoped diagnosis workflow', async ({ request }, testInfo) => {
  const scope = { tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: 'staging-project' };
  const workflowRunId = `browserworkflow${Date.now()}${testInfo.project.name}${testInfo.workerIndex}`;
  const diagnosisContent = `Diagnosis workflow preserves project evidence ${workflowRunId}.`;
  const retained = await request.post('/api/v1/memory/retain', { data: { ...scope, workflowRunId, content: diagnosisContent, source: 'browser-e2e', provenance: 'local-staging', idempotencyKey: `diagnosis-retain-${workflowRunId}` } });
  expect(retained.status()).toBe(201);
  const retainedBody = await retained.json();
  expect(retainedBody.state).toBe('healthy');
  expect(retainedBody.data.workflowRunId).toBe(workflowRunId);

  const recalled = await request.post('/api/v1/memory/recall', { data: { ...scope, workflowRunId, query: workflowRunId } });
  expect(recalled.ok()).toBeTruthy();
  const recalledBody = await recalled.json();
  expect(recalledBody.state).toBe('healthy');
  expect(recalledBody.data.workflowRunId).toBe(workflowRunId);

  const traced = await request.post('/api/v1/memory/trace', { data: { ...scope, workflowRunId, query: workflowRunId } });
  expect(traced.ok()).toBeTruthy();
  const trace = await traced.json();
  expect(trace.data.workflowRunId).toBe(workflowRunId);
  expect(trace.data.trace.items.some((item: { recordId: string }) => item.recordId === retainedBody.data.fact.id)).toBeTruthy();

  const corrected = await request.patch(`/api/v1/memory/${retainedBody.data.fact.id}`, { data: { ...scope, workflowRunId, claim: 'Diagnosis workflow preserves corrected project evidence.' } });
  expect(corrected.ok()).toBeTruthy();
  expect((await corrected.json()).state).toBe('healthy');

  const generatedAt = new Date().toISOString();
  const makeRun = (id: string, correct: boolean) => ({ id, projectId: scope.projectId, generatedAt, manifest: { corpusVersion: 'browser-diagnosis', corpusHash: 'browser-corpus', caseCount: 1, configVersion: 'browser-config', configHash: 'browser-config-hash' }, cases: [{ caseId: 'case-1', traceIds: [trace.data.trace.traceId], grounded: correct, citationPrecision: correct ? 1 : 0.5, unsupportedClaimRate: correct ? 0 : 0.5, graphAccuracy: 1, latencyMs: 10, queueDelayMs: 0, inputTokens: 1, outputTokens: 1, costUsd: 0, correct }] });
  const baseline = makeRun(`baseline-${scope.projectId}`, false);
  const replay = makeRun(`replay-${scope.projectId}`, true);
  const proposal = { id: `proposal-${scope.projectId}`, projectId: scope.projectId, sourceRunId: baseline.id, caseId: 'case-1', categories: ['correction'], traceIds: [trace.data.trace.traceId], proposedChange: 'apply correction', status: 'approved', createdAt: generatedAt };
  const replayed = await request.post('/api/v1/memory/replay', { data: { ...scope, workflowRunId, baseline, replay, proposal } });
  expect(replayed.status()).toBe(201);
  expect((await replayed.json()).state).toBe('healthy');

  const evaluated = await request.post('/api/v1/memory/evaluate', { data: { ...scope, workflowRunId, run: replay } });
  expect(evaluated.status()).toBe(201);
  expect((await evaluated.json()).state).toBe('healthy');

  const workflow = await request.get(`/api/v1/memory/workflow?tenantId=${scope.tenantId}&bankId=${scope.bankId}&projectId=${scope.projectId}&workflowRunId=${workflowRunId}`);
  expect(workflow.ok()).toBeTruthy();
  const workflowBody = await workflow.json();
  expect(workflowBody.data.workflowRunId).toBe(workflowRunId);
  expect(workflowBody.data.completedSteps).toContain('evaluate');

  const evidence = await request.get(`/api/project-memory/evaluations?tenantId=${scope.tenantId}&bankId=${scope.bankId}&projectId=${scope.projectId}`);
  expect(evidence.ok()).toBeTruthy();
  const evidenceBody = await evidence.json();
  expect(evidenceBody.data.runs).toHaveLength(2);
  expect(evidenceBody.data.replays).toHaveLength(1);
});

test('developer workbench keeps refresh and unavailable states explicit', async ({ page }) => {
  await page.route('**/api/v1/memory/workflow*', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, requestId: 'refresh-unavailable', state: 'unavailable', error: 'canonical store unavailable', retryable: true }) });
  });
  await page.goto('/sandbox/developer');
  await expect(page.getByRole('heading', { name: 'One workflow from source to evaluated memory' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh server state' }).click();
  await expect(page.getByText(/Server refresh unavailable/)).toBeVisible();
  await expect(page.getByText(/retryable true/)).toBeVisible();
});
