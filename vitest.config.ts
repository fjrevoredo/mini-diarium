import { defineConfig, configDefaults } from 'vitest/config';
import solid from 'vite-plugin-solid';
import UnoCSS from '@unocss/vite';

export default defineConfig({
  plugins: [
    solid({
      hot: false, // Disable HMR for tests
    }),
    UnoCSS(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**', '.reference/**', '.claude/**', 'tests/**', 'scripts/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src-tauri/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'scripts/**',
      ],
      // Backstop thresholds ~4 pts below measured values (2026-07-08: stmt 80.43%, branch 65.95%, fn 84.06%, line 81.51%).
      // These guard against regressions; raise them as coverage improves.
      thresholds: {
        statements: 76,
        branches: 62,
        functions: 80,
        lines: 77,
      },
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
