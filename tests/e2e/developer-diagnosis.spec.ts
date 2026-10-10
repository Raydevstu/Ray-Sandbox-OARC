import { expect, test } from '@playwright/test';

test('authenticated developer completes the project-scoped diagnosis workflow', async ({ request }) => {
  const scope = { tenantId: 'staging-tenant', bankId: 'staging-bank', projectId: `diagnosis-${Date.now()}` };
  const retained = await request.post('/api/v1/memory/retain', { data: { ...scope, content: 'Diagnosis workflow preserves project evidence.', source: 'browser-e2e', provenance: 'local-staging', idempotencyKey: `diagnosis-retain-${Date.now()}` } });
  expect(retained.status()).toBe(201);
  const retainedBody = await retained.json();
  expect(retainedBody.state).toBe('healthy');

  const recalled = await request.post('/api/v1/memory/recall', { data: { ...scope, query: 'project evidence' } });
  expect(recalled.ok()).toBeTruthy();
  expect((await recalled.json()).state).toBe('healthy');

  const traced = await request.post('/api/v1/memory/trace', { data: { ...scope, query: 'project evidence' } });
  expect(traced.ok()).toBeTruthy();
  const trace = await traced.json();
  expect(trace.data.trace.items.every((item: { recordId: string }) => item.recordId === retainedBody.data.fact.id)).toBeTruthy();

  const corrected = await request.patch(`/api/v1/memory/${retainedBody.data.fact.id}`, { data: { ...scope, claim: 'Diagnosis workflow preserves corrected project evidence.' } });
  expect(corrected.ok()).toBeTruthy();
  expect((await corrected.json()).state).toBe('healthy');

  const generatedAt = new Date().toISOString();
  const makeRun = (id: string, correct: boolean) => ({ id, projectId: scope.projectId, generatedAt, manifest: { corpusVersion: 'browser-diagnosis', corpusHash: 'browser-corpus', caseCount: 1, configVersion: 'browser-config', configHash: 'browser-config-hash' }, cases: [{ caseId: 'case-1', traceIds: [trace.data.trace.traceId], grounded: correct, citationPrecision: correct ? 1 : 0.5, unsupportedClaimRate: correct ? 0 : 0.5, graphAccuracy: 1, latencyMs: 10, queueDelayMs: 0, inputTokens: 1, outputTokens: 1, costUsd: 0, correct }] });
  const baseline = makeRun(`baseline-${scope.projectId}`, false);
  const replay = makeRun(`replay-${scope.projectId}`, true);
  const proposal = { id: `proposal-${scope.projectId}`, projectId: scope.projectId, sourceRunId: baseline.id, caseId: 'case-1', categories: ['correction'], traceIds: [trace.data.trace.traceId], proposedChange: 'apply correction', status: 'approved', createdAt: generatedAt };
  const replayed = await request.post('/api/v1/memory/replay', { data: { ...scope, baseline, replay, proposal } });
  expect(replayed.status()).toBe(201);
  expect((await replayed.json()).state).toBe('healthy');

  const evaluated = await request.post('/api/v1/memory/evaluate', { data: { ...scope, run: replay } });
  expect(evaluated.status()).toBe(201);
  expect((await evaluated.json()).state).toBe('healthy');

  const evidence = await request.get(`/api/project-memory/evaluations?tenantId=${scope.tenantId}&bankId=${scope.bankId}&projectId=${scope.projectId}`);
  expect(evidence.ok()).toBeTruthy();
  const evidenceBody = await evidence.json();
  expect(evidenceBody.data.runs).toHaveLength(2);
  expect(evidenceBody.data.replays).toHaveLength(1);
});
