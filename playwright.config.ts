import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4199;
const WEB_PORT = 5199;
const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), 'tracker-e2e-'));
process.env.E2E_DATA_DIR = dataDir;

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: 'npx tsx apps/server/src/main.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        HOST: '127.0.0.1',
        DATABASE_URL: join(dataDir, 'e2e.db'),
        UPLOADS_DIR: join(dataDir, 'uploads'),
        WEB_DIST: join(dataDir, 'no-web-dist'),
        TRACKER_TEST_RESET: '1',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: './apps/web',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { TRACKER_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
