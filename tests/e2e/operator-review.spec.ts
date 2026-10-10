import { expect, test } from '@playwright/test';

test('operator can record an evidence-linked review mutation', async ({ page, request }) => {
  const auditResponse = await request.get('/api/project-memory/audit?projectId=staging-project');
  expect(auditResponse.ok()).toBeTruthy();
  const auditBody = await auditResponse.json();
  const reviewable = auditBody.data.audit.records.find((record: { status: string }) => ['conflict', 'uncertain', 'stale'].includes(record.status));
  test.skip(!reviewable, 'staging has no conflict, uncertain, or stale record for a safe review mutation');

  await page.goto('/sandbox/memory-audit?projectId=staging-project');
  const reason = `Browser review verification for ${reviewable.id}`;
  await page.locator('input[aria-label="Review reason"]').first().fill(reason);
  await page.getByRole('button', { name: 'Record review' }).first().click();
  await expect(page.getByRole('status')).toContainText('Review recorded');

  const eventsResponse = await request.get('/api/project-memory/events?tenantId=staging-tenant&bankId=staging-bank&projectId=staging-project');
  expect(eventsResponse.ok()).toBeTruthy();
  const eventsBody = await eventsResponse.json();
  expect(eventsBody.data.events.some((event: { type: string; payload: { recordId?: string; reason?: string } }) => event.type === 'ProjectMemoryReviewCompleted' && event.payload.recordId === reviewable.id && event.payload.reason === reason)).toBe(true);
});
