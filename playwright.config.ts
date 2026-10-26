import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    extraHTTPHeaders: {
      'x-dev-subject': 'browser-e2e',
      'x-dev-tenant-id': 'staging-tenant',
      'x-dev-bank-id': 'staging-bank',
      'x-dev-project-id': 'RayBots',
      'x-dev-allowed-project-ids': 'RayBots',
      'x-dev-scopes': 'events:write memory:read memory:write',
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- -p 3000',
    url: 'http://127.0.0.1:3000/api/v1/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
