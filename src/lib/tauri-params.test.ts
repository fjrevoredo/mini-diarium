import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  navigatePreviousDay,
  navigateNextDay,
  navigatePreviousMonth,
  navigateNextMonth,
} from './tauri';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

/**
 * Tests to verify Tauri command parameter names are correct
 *
 * BUG: Frontend was passing snake_case parameter names (current_date)
 * but Tauri v2 expects camelCase parameter names (currentDate)
 */
describe('Tauri Navigation Parameter Names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigatePreviousDay should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2024-01-14');

    await navigatePreviousDay('2024-01-15');

    // Should call with camelCase parameter name
    expect(mockInvoke).toHaveBeenCalledWith('navigate_previous_day', {
      currentDate: '2024-01-15',
    });
  });

  it('navigateNextDay should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2024-01-16');

    await navigateNextDay('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('navigate_next_day', {
      currentDate: '2024-01-15',
    });
  });

  it('navigatePreviousMonth should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2023-12-15');

    await navigatePreviousMonth('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('navigate_previous_month', {
      currentDate: '2024-01-15',
    });
  });

  it('navigateNextMonth should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2024-02-15');

    await navigateNextMonth('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('navigate_next_month', {
      currentDate: '2024-01-15',
    });
  });
});
