import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Every layout assertion assumes the desktop studio size the planner was designed for
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 820 } },
    },
  ],
  webServer: {
    command: 'node tests/support/static-server.js',
    url: BASE_URL,
    env: { PORT: String(PORT) },
    reuseExistingServer: !isCI,
  },
});
