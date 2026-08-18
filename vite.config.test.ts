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
    // `force: true` discards Vite's lockfile/config-hash cache on every dev run,
    // which was itself the cause of a multi-minute cold-scan stall on Windows —
    // must not come back.
    expect(config.optimizeDeps?.force).not.toBe(true);
  });
});
