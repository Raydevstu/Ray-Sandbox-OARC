import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('authenticated operator journey covers audit, events, manifest, and trace', async ({ page, request }) => {
  const query = 'tenantId=staging-tenant&bankId=staging-bank&projectId=staging-project';
  for (const path of [`/api/project-memory/audit?projectId=staging-project`, `/api/project-memory/events?${query}`, `/api/project-memory/manifest?${query}`, `/api/project-memory/trace?projectId=staging-project&query=git%20status`, `/api/project-memory/graph?label=staging-project&at=2026-10-10T00:00:00.000Z`]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
  }
  for (const path of ['/sandbox/memory-audit?projectId=staging-project', `/sandbox/memory-trace?projectId=staging-project&query=git%20status`]) {
    await page.goto(path);
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.locator('main').last()).toBeVisible();
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id), path).toEqual([]);
  }
});
