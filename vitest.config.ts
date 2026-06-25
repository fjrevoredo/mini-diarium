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
    exclude: [...configDefaults.exclude, 'e2e/**', '.reference/**', '.claude/**', 'tests/**'],
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
      ],
      // Backstop thresholds ~5 pts below measured values (2026-06-18: stmt 73%, branch 60%, fn 76%, line 73%).
      // These guard against regressions; raise them as coverage improves.
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 72,
        lines: 70,
      },
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
