import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/print',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/print-results.json' }]],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
