import { describe, expect, it } from 'vitest';
import viteConfig from './vite.config';

describe('Vite development optimizer', () => {
  it('uses a bounded, cache-independent SPA startup path', async () => {
    const config = await viteConfig({
      command: 'serve',
      mode: 'development',
      isSsrBuild: false,
      isPreview: false,
    });

    expect(config.optimizeDeps).toMatchObject({
      entries: ['index.html'],
      force: true,
      holdUntilCrawlEnd: false,
    });
  });
});
