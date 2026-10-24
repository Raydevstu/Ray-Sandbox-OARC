import { expect, test } from '@playwright/test';

test('Context Tuning saves settings and restores them after reload', async ({ page }) => {
  await page.goto('/sandbox/context');
  await expect(page.getByText('Retrieval budget & token ceiling')).toBeVisible();
  await page.goto('/sandbox/settings');
  await page.getByRole('button', { name: 'Runtime', exact: true }).click();
  await page.goto('/sandbox/context');
  await expect(page.getByText('Retrieval budget & token ceiling')).toBeVisible();
  const slider = page.getByLabel('max_tokens — context returned to the agent');
  await expect(slider).toBeVisible();
  await slider.fill('8192');
  await page.getByRole('button', { name: /Run with these settings/i }).click();
  await expect(page.getByRole('status')).toContainText('Context tuning persisted');
  await page.reload();
  await expect(page.getByLabel('max_tokens — context returned to the agent')).toHaveValue('8192');
});
