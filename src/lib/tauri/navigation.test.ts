import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { navigateToToday } from './navigation';

// NOTE: navigatePreviousDay/NextDay/PreviousMonth/NextMonth are covered by
// tauri-params.test.ts. This suite covers the no-arg navigateToToday wrapper.

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('navigation command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigateToToday → navigate_to_today and passes the date through', async () => {
    mockInvoke.mockResolvedValue('2024-06-15');
    await expect(navigateToToday()).resolves.toBe('2024-06-15');
    expect(mockInvoke).toHaveBeenCalledWith('navigate_to_today');
  });
});
