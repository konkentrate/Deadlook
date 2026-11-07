import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/ui', fullyParallel: true, retries: process.env.CI ? 1 : 0,
 use: {
  baseURL: 'http://127.0.0.1:4173',
  browserName: 'chromium',
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] } : {},
  trace: 'retain-on-failure', screenshot: 'only-on-failure',
 },
 webServer: {
  command: 'PORT=4173 HOST=127.0.0.1 node server/index.js',
  url: 'http://127.0.0.1:4173/api/health',
  reuseExistingServer: !process.env.CI,
 },
});
