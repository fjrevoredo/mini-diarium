import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  isFlatpakSandbox: vi.fn(),
}));

vi.mock('../lib/tauri', () => ({
  isFlatpakSandbox: mocks.isFlatpakSandbox,
}));

import { isFlatpak, loadPlatformInfo } from './platform';

describe('platform state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to false before loadPlatformInfo resolves', () => {
    expect(isFlatpak()).toBe(false);
  });

  it('reflects the backend result after loadPlatformInfo resolves', async () => {
    mocks.isFlatpakSandbox.mockResolvedValueOnce(true);
    await loadPlatformInfo();
    expect(isFlatpak()).toBe(true);

    mocks.isFlatpakSandbox.mockResolvedValueOnce(false);
    await loadPlatformInfo();
    expect(isFlatpak()).toBe(false);
  });
});
