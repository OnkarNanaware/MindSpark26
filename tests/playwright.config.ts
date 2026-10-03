import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const isProd = BASE_URL.startsWith('https://');

export default defineConfig({
  testDir: '.',
  // Serial in production to respect rate limiting; parallel locally
  fullyParallel: !isProd,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: isProd ? 1 : (process.env.CI ? 1 : undefined),
  reporter: 'html',
  // Production scans hit a live backend — allow extra time
  timeout: isProd ? 300000 : 200000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Skip Firefox/WebKit in production — single-browser is enough for live smoke tests
    ...(isProd ? [] : [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ]),
    {
      name: 'responsive-chromium',
      testMatch: /responsive\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    ...(isProd ? [] : [
      {
        name: 'responsive-firefox',
        testMatch: /responsive\/.*\.spec\.ts/,
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'responsive-webkit',
        testMatch: /responsive\/.*\.spec\.ts/,
        use: { ...devices['Desktop Safari'] },
      },
    ]),
  ],
  // Skip local dev server when testing against a live URL
  ...(isProd ? {} : {
    webServer: {
      command: 'cd ../frontend && npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  }),
});
