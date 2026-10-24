import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('dashboard requires an authorized session before showing runtime data', async ({ page }) => {
  await page.context().clearCookies();
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sandbox');

    await expect(page.getByText('Project runtime telemetry')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Disconnected');
    await expect(page.getByText('Four-network mix')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.runtime-signal-particle')).toHaveCount(0);
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id), `width ${width}`).toEqual([]);
  }
});
