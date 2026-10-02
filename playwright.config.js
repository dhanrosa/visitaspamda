import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1,
  use: { baseURL: process.env.PAMDA_TEST_URL || 'http://127.0.0.1:3173', browserName: 'chromium', channel: 'chrome', headless: true, viewport: { width: 1440, height: 960 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: process.env.PAMDA_TEST_EXTERNAL ? undefined : { command: 'node node_modules/vite/bin/vite.js', url: 'http://127.0.0.1:3173', env: { PORT: '3173', VITE_SUPABASE_URL: 'https://pamda-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, reuseExistingServer: false },
});
