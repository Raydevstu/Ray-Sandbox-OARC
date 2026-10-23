import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('authenticated temporal graph journey exposes aliases, conflicts, and two-hop evidence', async ({ page, request }) => {
  const at = '2026-10-10T00:00:00.000Z';
  const response = await request.get(`/api/project-memory/graph?label=staging-project&at=${encodeURIComponent(at)}&maxHops=2`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.data).toHaveProperty('resolution');
  expect(body.data).toHaveProperty('explanation');
  expect(body.data.explanation.paths).toBeInstanceOf(Array);

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`/sandbox/memory-trace?projectId=staging-project&query=git%20status`);
  await expect(page.locator('main').last()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await injectAxe(page);
  const results = await getAxeResults(page);
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id)).toEqual([]);
});
