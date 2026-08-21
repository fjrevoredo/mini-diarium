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
  // `entries` pins Vite's dependency scan to the real SPA entry point. This matches
  // the installed Vite's own default (it already crawls just `index.html`), so it's
  // a defensive pin against that default ever changing back to a repo-root glob —
  // not an active workaround. (It was an active fix on an older Vite that defaulted
  // to a `**/*.html` crawl of the repo root, sweeping in the 30+ GB `/target/` Cargo
  // build output; that default no longer exists in the installed version.)
  //
  // Deliberately NOT setting `force: true` here: it discards Vite's lockfile/config-hash
  // cache and pays a full re-optimize on every run instead of only when the lockfile or
  // config hash actually changes. Measured cold and isolated on Windows, that re-optimize
  // costs ~13s (scan + bundle) — worth avoiding per run, but note it was NOT the cause of
  // the multi-minute startup stalls this file's `server.watch.ignored` comment describes;
  // an earlier CHANGELOG entry attributed them here and was wrong. If a cache is ever
  // suspected corrupt, pass `--force` manually: `bun run tauri dev -- --force`.
  optimizeDeps: {
    include: ['solid-js', '@tiptap/core'],
    entries: ['index.html'],
    // Let the first page requests proceed while Vite finishes the optimizer crawl
    // instead of holding the WebView on a blank document until the crawl completes.
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
      // `target/**`: the Cargo workspace build output sits at the repo root since the M1
      // workspace split, and Vite hands chokidar the repo root — its built-in ignore list
      // covers `.git`/`node_modules`/`dist` but not `target`. Left in, the dev server
      // registers ~61k watch handles over ~40 GB of build output (91% of everything it
      // watches), and a concurrent `cargo build` both floods it with thousands of events
      // and can kill it outright with the same EBUSY crash as above, on the `.dll` the
      // linker is mid-write. This starves the dependency scan and module transforms and
      // is the root cause of the multi-minute `bun tauri dev` startup stalls.
      // Full RCA: docs/archive/2026-08-21-tauri-dev-startup-slowness-rca.md
      ignored: ['**/src-tauri/**', '**/.agent-dev/**', '**/target/**'],
    },
  },
}));
