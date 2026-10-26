import { expect, test } from '@playwright/test';
import { getAxeResults, injectAxe } from 'axe-playwright';

test('design gallery provides interactive, synthetic enterprise templates', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/sandbox/design-gallery');

    await expect(page.getByRole('heading', { name: 'Enterprise visual gallery' })).toBeVisible();
    await expect(page.getByText('Synthetic preview data')).toBeVisible();
    await page.getByRole('button', { name: 'Pause stream' }).click();
    await expect(page.getByRole('button', { name: 'Resume stream' })).toBeVisible();
    await page.getByRole('button', { name: '6h' }).click();
    await page.getByRole('button', { name: 'Critical' }).click();
    await page.getByRole('row', { name: /Recall path exceeded budget/ }).click();
    await expect(page.getByText('The synthetic recall path crossed the configured cost threshold.')).toBeVisible();
    await page.getByRole('button', { name: 'Policy gate' }).first().click();
    await expect(page.getByText('Synthetic policy decision boundary.')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')).map((violation) => violation.id), `width ${width}`).toEqual([]);
  }
});

test('design gallery makes empty evidence filtering explicit', async ({ page }) => {
  await page.goto('/sandbox/design-gallery');
  await page.getByRole('textbox', { name: 'Search evidence' }).fill('not-present');
  await expect(page.getByText('No matching evidence')).toBeVisible();
});
