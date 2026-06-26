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
      // Backstop thresholds ~4 pts below measured values (2026-06-26: stmt 73.82%, branch 60.16%, fn 75.94%, line 73.60%).
      // These guard against regressions; raise them as coverage improves.
      thresholds: {
        statements: 69,
        branches: 56,
        functions: 71,
        lines: 69,
      },
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
