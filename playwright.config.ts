import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/print',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
