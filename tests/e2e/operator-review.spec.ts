import { expect, test } from '@playwright/test';

test('operator can record an evidence-linked review mutation', async ({ page, request }) => {
  const projectId = `browser-review-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const prefix = 'We will retain the governed review decision with immutable source evidence and explicit project scope. ';
  const imported = await request.post('/api/project-memory/import', { data: {
    tenantId: 'staging-tenant', bankId: 'staging-bank', projectId, platform: 'codex', conversationId: `review-${projectId}`, exportedAt: timestamp, sourceReference: `browser://${projectId}`,
    messages: [
      { id: 'decision-a', role: 'user', timestamp, content: `${prefix}The first supported conclusion is alpha.` },
      { id: 'decision-b', role: 'assistant', timestamp, content: `${prefix}The conflicting supported conclusion is beta.` },
    ],
  } });
  expect(imported.ok()).toBeTruthy();

  const auditResponse = await request.get(`/api/project-memory/audit?projectId=${projectId}`);
  expect(auditResponse.ok()).toBeTruthy();
  const auditBody = await auditResponse.json();
  const reviewable = auditBody.data.audit.records.find((record: { status: string }) => ['conflict', 'uncertain', 'stale'].includes(record.status));
  expect(reviewable).toBeTruthy();

  await page.goto(`/sandbox/memory-audit?projectId=${projectId}`);
  const reason = `Browser review verification for ${reviewable.id}`;
  await page.locator('input[aria-label="Review reason"]').first().fill(reason);
  await page.getByRole('button', { name: 'Record review' }).first().click();
  await expect(page.getByRole('status')).toContainText('Review recorded');

  const eventsResponse = await request.get(`/api/project-memory/events?tenantId=staging-tenant&bankId=staging-bank&projectId=${projectId}`);
  expect(eventsResponse.ok()).toBeTruthy();
  const eventsBody = await eventsResponse.json();
  expect(eventsBody.data.events.some((event: { type: string; payload: { recordId?: string; reason?: string } }) => event.type === 'ProjectMemoryReviewCompleted' && event.payload.recordId === reviewable.id && event.payload.reason === reason)).toBe(true);

  const exportResponse = await request.get(`/api/project-memory/export?tenantId=staging-tenant&bankId=staging-bank&projectId=${projectId}&format=markdown`);
  expect(exportResponse.ok()).toBeTruthy();
  expect(exportResponse.headers()['content-disposition']).toContain(`${projectId}-memory-manifest.md`);
  expect(await exportResponse.text()).toContain(projectId);
});
