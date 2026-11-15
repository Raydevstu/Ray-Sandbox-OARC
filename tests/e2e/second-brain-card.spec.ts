import { expect, test } from '@playwright/test';

test.describe('SECOND-BRAIN status card', () => {
  test('renders card, state badges, and control links with seeded status', async ({ page }) => {
    await page.route('**/api/project-memory/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            state: 'processed',
            capture: { state: 'processed', processed: 12, failed: 0 },
            storeMode: 'postgres',
            retentionSweeper: { scanned: 40, softDeleted: 3, purged: 1, durationMs: 120, at: '2026-11-15T00:00:00.000Z' },
            clientStatuses: [
              { platform: 'opencode', state: 'captured', at: '2026-11-15T01:00:00.000Z', spoolDepth: 0, project: 'SECOND-BRAIN' },
              { platform: 'codex', state: 'skipped_optout', at: '2026-11-15T00:50:00.000Z', spoolDepth: 0, optOut: true },
              { platform: 'hermes', state: 'spooled_offline', at: '2026-11-15T00:40:00.000Z', spoolDepth: 7, lastError: 'hub down' },
              { platform: 'browser', state: 'failed_retrying', at: '2026-11-15T00:30:00.000Z', spoolDepth: 2, lastError: 'timeout' },
              { platform: 'worker', state: 'dropped_spool_overflow', at: '2026-11-15T00:20:00.000Z', spoolDepth: 5000 },
            ],
          },
        }),
      });
    });

    await page.route('**/api/project-memory/operations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            status: 'ok',
            retentionSweeper: { scanned: 40, softDeleted: 3, purged: 1, durationMs: 120, at: '2026-11-15T00:00:00.000Z' },
          },
        }),
      });
    });

    await page.route('**/api/project-memory/audit**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { audit: { records: [] } } }) });
    });

    await page.goto('/sandbox');

    const card = page.getByTestId('second-brain-card');
    await expect(card).toBeVisible();
    await expect(card.getByText('SECOND-BRAIN status')).toBeVisible();
    await expect(card.getByTestId('second-brain-store-mode')).toHaveText('postgres');

    // State badges/classes of each state class (green/gray/red via data-state rows present)
    await expect(card.locator('[data-testid="second-brain-agent-row"][data-state="captured"]')).toBeVisible();
    await expect(card.locator('[data-testid="second-brain-agent-row"][data-state="skipped_optout"]')).toBeVisible();
    await expect(card.locator('[data-testid="second-brain-agent-row"][data-state="spooled_offline"]')).toBeVisible();
    await expect(card.locator('[data-testid="second-brain-agent-row"][data-state="failed_retrying"]')).toBeVisible();
    await expect(card.locator('[data-testid="second-brain-agent-row"][data-state="dropped_spool_overflow"]')).toBeVisible();

    // Opt-out badge and loud error visibility
    await expect(card.getByText('opt-out')).toBeVisible();
    await expect(card.getByText(/Last error: hub down/)).toBeVisible();
    await expect(card.getByText(/Sweeper last run/)).toBeVisible();

    // Links to existing control surfaces
    await expect(card.getByRole('link', { name: 'Audit' })).toHaveAttribute('href', /\/sandbox\/memory-audit/);
    await expect(card.getByRole('link', { name: 'Review / Operator' })).toHaveAttribute('href', /\/sandbox\/operator/);
    await expect(card.getByRole('link', { name: 'Policies / Settings' })).toHaveAttribute('href', /\/sandbox\/settings/);
    await expect(card.getByRole('link', { name: 'Export' })).toHaveAttribute('href', /\/api\/project-memory\/export/);
  });
});
