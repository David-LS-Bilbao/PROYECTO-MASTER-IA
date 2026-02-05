import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * E2E Testing setup for Verity News Frontend (Sprint 14 - Tarea 3)
 *
 * Configuration:
 * - Base URL: http://localhost:3001 (Next.js frontend)
 * - Browsers: Chromium (primary browser)
 * - Traces: on-first-retry (for debugging failed tests)
 * - Timeout: 30s per test
 * - Retries: 1 retry on CI, 0 locally
 *
 * Requirements:
 * - Frontend running on http://localhost:3001 (npm run dev)
 * - Backend running on http://localhost:3000 (optional for some tests)
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential execution for auth tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker for session consistency
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test in Firefox and Safari
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
