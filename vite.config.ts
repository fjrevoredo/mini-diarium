import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import UnoCSS from '@unocss/vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid(), UnoCSS()],

  // Build optimizations
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: false, // Inline all CSS in one file for faster loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'vendor-solid': ['solid-js'],
          'vendor-tiptap': ['@tiptap/core', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],
          'vendor-ui': ['@kobalte/core'],
        },
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['solid-js', '@tiptap/core', '@kobalte/core/dialog', 'lucide-solid'],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
