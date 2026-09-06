import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { isFlatpakSandbox } from './platform';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('platform command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isFlatpakSandbox → is_flatpak_sandbox and passes the result through', async () => {
    mockInvoke.mockResolvedValueOnce(true);
    await expect(isFlatpakSandbox()).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('is_flatpak_sandbox');
  });

  it('passes a false result through', async () => {
    mockInvoke.mockResolvedValueOnce(false);
    await expect(isFlatpakSandbox()).resolves.toBe(false);
  });
});
