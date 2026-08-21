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
  server: {
    watch: {
      // Same exposure as vite.config.ts: Vite hands chokidar the repo root, and its
      // built-in ignore list does not cover the 40 GB Cargo `target/` tree that sits
      // there since the M1 workspace split. `vitest run` sets `server.watch = null`
      // so CI is unaffected, but `bun run test` (watch mode) would otherwise register
      // ~61k watch handles over build output. See
      // docs/archive/2026-08-21-tauri-dev-startup-slowness-rca.md.
      ignored: ['**/src-tauri/**', '**/target/**', '**/.agent-dev/**'],
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
