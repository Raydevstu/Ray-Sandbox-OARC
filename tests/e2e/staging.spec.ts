import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test.describe('staging operational surfaces', () => {
  test('loads the sandbox and has no serious accessibility violations', async ({ page }) => {
    await page.goto('/sandbox');
    await expect(page).toHaveTitle(/Ray Sandbox OARC|Hindsight/i);
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id)).toEqual([]);
  });

  test('shows benchmark and audit surfaces at narrow and wide layouts', async ({ page }) => {
    await page.goto('/sandbox/benchmarks');
    await expect(page.getByRole('heading', { name: 'Benchmark explorer' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/sandbox/memory-audit');
    await expect(page.getByText('Project memory audit', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText(/run event history/i)).toBeVisible();
  });

  test('can read authenticated audit data through the staging API', async ({ request }) => {
    const response = await request.get('/api/project-memory/audit?projectId=staging-project');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.audit.projectId).toBe('staging-project');
  });
});
