import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('onboarding exposes the four-step explainable-memory journey', async ({ page }) => {
  await page.goto('/sandbox/onboarding');
  await expect(page.getByRole('heading', { name: 'From conversation to explainable memory' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Connect your agent/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Inspect the evidence/i })).toBeVisible();
  await injectAxe(page);
  const results = await getAxeResults(page);
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id)).toEqual([]);
});
