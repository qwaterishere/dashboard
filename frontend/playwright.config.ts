import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'line' : 'list',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'bash scripts/e2e-backend.sh',
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      cwd: __dirname,
    },
    {
      command: 'npm run start -- --host 127.0.0.1 --port 4200',
      url: baseURL,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
