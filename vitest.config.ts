import { defineConfig } from 'vitest/config';
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src-tauri/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
