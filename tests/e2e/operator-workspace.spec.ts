import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('operator workspace is keyboard accessible and explicit about runtime states', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sandbox/operator');
    await expect(page.getByRole('heading', { name: 'Diagnose memory without reading logs' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Evidence/ })).toBeVisible();
    await expect(page.getByText('Unauthorized', { exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id), `width ${width}`).toEqual([]);
  }
});
