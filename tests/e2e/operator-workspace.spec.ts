import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('operator workspace is keyboard accessible and explicit about runtime states', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sandbox/operator');
    await expect(page.getByRole('heading', { name: 'Diagnose memory without reading logs' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Enter Local PostgreSQL staging operator session/ })).toBeVisible();
    await expect(page.getByRole('status').first()).toContainText('Unauthorized');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id), `width ${width}`).toEqual([]);
  }
});

test('operator workspace establishes a scoped local session and reads server evidence', async ({ page }) => {
  await page.goto('/sandbox/operator');
  await page.getByRole('button', { name: /Enter Local PostgreSQL staging operator session/ }).click();
  await expect(page.getByTestId('operator-evidence-dashboard')).toBeVisible();
  await expect(page.getByText('Local PostgreSQL staging')).toBeVisible();
  await expect(page.getByText('Server-sourced durable evidence')).toBeVisible();
  await expect(page.getByRole('link', { name: /Events/ })).toBeVisible();

  const crossScopeStatus = await page.evaluate(async () => (await fetch('/api/project-memory/events?tenantId=staging-tenant&bankId=staging-bank&projectId=other-project')).status);
  expect(crossScopeStatus).toBe(403);
});
