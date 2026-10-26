import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('docs hub gives new users platform setup guides and safety context', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sandbox/docs');

    await expect(page.getByRole('heading', { level: 1, name: 'Docs & Guides' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Choose your platform' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hermes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'OpenCode' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Codex' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'VS Code' })).toBeVisible();
    await page.getByRole('tab', { name: 'OpenCode' }).click();
    await expect(page.getByRole('heading', { name: 'OpenCode setup' })).toBeVisible();
    await page.getByRole('tab', { name: 'OpenCode' }).press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Codex' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Codex setup' })).toBeVisible();
    await expect(page.getByText('Do not use a database password as an agent token.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Integrations' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id), `width ${width}`).toEqual([]);
  }
});
