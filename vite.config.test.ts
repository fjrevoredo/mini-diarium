import { describe, expect, it } from 'vitest';
import viteConfig from './vite.config';

describe('Vite development optimizer', () => {
  it('scopes the dependency scan to the SPA entry and reuses the optimizer cache across runs', async () => {
    const config = await viteConfig({
      command: 'serve',
      mode: 'development',
      isSsrBuild: false,
      isPreview: false,
    });

    expect(config.optimizeDeps).toMatchObject({
      entries: ['index.html'],
      holdUntilCrawlEnd: false,
    });
    // `force: true` discards Vite's lockfile/config-hash cache on every dev run, paying
    // the full cold scan+bundle (~13s measured) every time instead of only when the
    // lockfile or config hash actually changes — must not come back.
    expect(config.optimizeDeps?.force).not.toBe(true);
  });

  it('excludes the Cargo target directory from the dev-server file watcher', async () => {
    const config = await viteConfig({
      command: 'serve',
      mode: 'development',
      isSsrBuild: false,
      isPreview: false,
    });

    // Vite hands chokidar the repo root and its built-in ignore list covers
    // `.git`/`node_modules`/`dist` but not `target`. Without this entry the dev server
    // registers ~61k watch handles over the 40 GB Cargo build output and a concurrent
    // `cargo build` can kill it with EBUSY. Root cause of the `bun tauri dev` startup
    // stalls — see docs/archive/2026-08-21-tauri-dev-startup-slowness-rca.md.
    expect(config.server?.watch?.ignored).toContain('**/target/**');
  });
});
