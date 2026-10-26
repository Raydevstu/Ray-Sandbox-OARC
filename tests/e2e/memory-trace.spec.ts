import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('authenticated Memory Trace journey exposes lineage and has no serious accessibility violations', async ({ page }) => {
  await page.goto('/sandbox/memory-trace?projectId=staging-project&query=launch');
  await expect(page.getByRole('heading', { name: 'Memory Trace', level: 3 })).toBeVisible();
  await expect(page.getByText(/source evidence|selection rationale/i).first()).toBeVisible();
  await injectAxe(page);
  const results = await getAxeResults(page);
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id)).toEqual([]);
});
