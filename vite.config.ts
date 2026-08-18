import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import UnoCSS from '@unocss/vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid(), UnoCSS()],

  // Feature flags: build-time constants tree-shaken by the bundler.
  // Gate unfinished UI with: <Show when={import.meta.env.VITE_EXPERIMENTAL}>
  // Production builds never set VITE_EXPERIMENTAL. Dev/canary: VITE_EXPERIMENTAL=true bun run tauri dev
  define: {
    // @ts-expect-error process is a nodejs global
    'import.meta.env.VITE_EXPERIMENTAL': JSON.stringify(process.env.VITE_EXPERIMENTAL === 'true'),
  },

  // Build optimizations
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: false, // Inline all CSS in one file for faster loading
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate vendor chunks for better caching (function form required by Vite 8 / rolldown)
          if (id.includes('node_modules/solid-js')) return 'vendor-solid';
          if (id.includes('node_modules/@tiptap')) return 'vendor-tiptap';
          if (id.includes('node_modules/@kobalte')) return 'vendor-ui';
        },
      },
    },
  },

  // Optimize dependencies
  // `entries` narrows Vite's esbuild/rolldown dependency scan to the real SPA
  // entry point. Without it, Vite's default `computeEntries()` globs `**/*.html`
  // from the repo root (ignoring only `outDir` and `node_modules`, and NOT
  // honoring .gitignore), sweeping in the 30+ GB `/target/` Cargo build output
  // and `.reference/` vendor checkout as scan "entry points" and stalling
  // `bun tauri dev` startup for minutes.
  optimizeDeps: {
    include: ['solid-js', '@tiptap/core'],
    entries: ['index.html'],
    // Never trust a previous optimizer cache for Tauri dev. An interrupted
    // `tauri dev` can leave a syntactically valid but unusable cache: Vite
    // reports ready, while WebView2 waits indefinitely for module responses.
    // Rebundling is bounded (about ten seconds on this workspace) and is
    // preferable to a multi-minute black window or loading spinner.
    force: true,
    // The explicit SPA entry above covers the static graph. Let the first
    // page requests proceed while Vite finishes the optimizer crawl instead
    // of holding the WebView on a blank document until the crawl completes.
    holdUntilCrawlEnd: false,
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
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      // `.agent-dev/**`: the tauri-agent-dev skill's sandbox WebView profile lives under the
      // repo root (`.agent-dev/sandbox/webview/`), and WebView2 holds an exclusive lock on its
      // `Cookies` file. Vite's fs watcher crashes the whole dev server with EBUSY the moment it
      // tries to watch that file, so this directory must stay excluded the same way `src-tauri`
      // is.
      ignored: ['**/src-tauri/**', '**/.agent-dev/**'],
    },
  },
}));
