import { expect, test } from '@playwright/test';

test('dashboard does not render seed metrics before a project stream is selected', async ({ page }) => {
  await page.goto('http://127.0.0.1:3030/sandbox');
  await expect(page.getByText('Project runtime telemetry')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Disconnected');
  await expect(page.getByText('Four-network mix')).toHaveCount(0);
  await expect(page.getByLabel('Project runtime topology')).toHaveCount(0);
});
