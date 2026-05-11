import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_WEB_PORT ?? 4173);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3001);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use signed-in state for authenticated tests
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      // API: skip if E2E_SKIP_API_SERVER=1 (e.g. when running against an already-up backend)
      command: 'npm run start:prod --workspace=@renthub/api',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      cwd: '../..',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        WEB_URL: BASE_URL,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        E2E_TESTING: '1', // Enable high rate limits for E2E tests
      },
    },
    {
      command: `npx vite preview --port ${PORT} --strictPort`,
      url: BASE_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
