import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real API, worker and Mailpit (doc 05 §13). Each zone project
 * reseeds the e2e scenario first, so projects run one after another on one worker.
 * Prerequisites (README "End-to-end tests"): Postgres and Mailpit up, the API on E2E_API with
 * RATE_LIMIT_MULTIPLIER=100, and the worker sending to Mailpit.
 */
// CI tests the built app (vite preview); locally the dev server is reused if it is running.
const CI = Boolean(process.env.CI);
const WEB = process.env.E2E_WEB ?? (CI ? 'http://localhost:4173' : 'http://localhost:5173');

const zone = (timezoneId: string, locale: string) => ({
  ...devices['Desktop Chrome'],
  timezoneId,
  locale,
});

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: { baseURL: WEB, trace: 'retain-on-failure' },
  webServer: {
    command: CI ? 'npm run preview' : 'npm run dev',
    url: WEB,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'seed-london',
      testMatch: /seed\.setup\.ts$/,
      use: zone('Europe/London', 'en-GB'),
    },
    {
      name: 'london',
      dependencies: ['seed-london'],
      testIgnore: /(a11y|visual)\.e2e\.ts$/,
      use: zone('Europe/London', 'en-GB'),
    },
    {
      name: 'seed-los-angeles',
      dependencies: ['london'],
      testMatch: /seed\.setup\.ts$/,
      use: zone('America/Los_Angeles', 'en-US'),
    },
    {
      name: 'los-angeles',
      dependencies: ['seed-los-angeles'],
      testIgnore: /(a11y|visual)\.e2e\.ts$/,
      use: zone('America/Los_Angeles', 'en-US'),
    },
    {
      name: 'a11y-and-screens',
      dependencies: ['los-angeles'],
      testMatch: /(a11y|visual)\.e2e\.ts$/,
      use: zone('Europe/London', 'en-GB'),
    },
  ],
});
