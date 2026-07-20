import { describe, it, expect, vi, beforeEach } from 'vitest';
import { goToPreviousDay, goToNextDay } from './day-navigation';
import { selectedDate, setSelectedDate } from '../state/ui';
import { setPreferences } from '../state/preferences';
import { getTodayString, addDays } from './dates';

const { mockNavigatePreviousDay, mockNavigateNextDay } = vi.hoisted(() => ({
  mockNavigatePreviousDay: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateNextDay: vi.fn<(currentDate: string) => Promise<string>>(),
}));

vi.mock('./tauri', async () => {
  const actual = await vi.importActual<typeof import('./tauri')>('./tauri');
  return {
    ...actual,
    navigatePreviousDay: mockNavigatePreviousDay,
    navigateNextDay: mockNavigateNextDay,
  };
});

describe('day-navigation', () => {
  beforeEach(() => {
    mockNavigatePreviousDay.mockReset();
    mockNavigateNextDay.mockReset();
  });

  it('goToPreviousDay sets selectedDate to the backend-resolved previous day', async () => {
    setSelectedDate('2024-01-15');
    mockNavigatePreviousDay.mockResolvedValue('2024-01-14');

    await goToPreviousDay();

    expect(mockNavigatePreviousDay).toHaveBeenCalledWith('2024-01-15');
    expect(selectedDate()).toBe('2024-01-14');
  });

  it('goToNextDay sets selectedDate to the backend-resolved next day', async () => {
    setPreferences({ allowFutureEntries: true });
    setSelectedDate('2024-01-15');
    mockNavigateNextDay.mockResolvedValue('2024-01-16');

    await goToNextDay();

    expect(mockNavigateNextDay).toHaveBeenCalledWith('2024-01-15');
    expect(selectedDate()).toBe('2024-01-16');
  });

  it('goToNextDay clamps to today when future entries are disabled', async () => {
    setPreferences({ allowFutureEntries: false });
    const today = getTodayString();
    const tomorrow = addDays(today, 1);
    setSelectedDate(today);
    mockNavigateNextDay.mockResolvedValue(tomorrow);

    await goToNextDay();

    expect(selectedDate()).toBe(today);
  });

  it('goToNextDay does not clamp a non-future result when future entries are disabled', async () => {
    setPreferences({ allowFutureEntries: false });
    setSelectedDate('2024-01-15');
    mockNavigateNextDay.mockResolvedValue('2024-01-16');

    await goToNextDay();

    expect(selectedDate()).toBe('2024-01-16');
  });

  it('goToPreviousDay leaves selectedDate unchanged when the backend rejects', async () => {
    setSelectedDate('2024-01-15');
    mockNavigatePreviousDay.mockRejectedValue(new Error('boom'));

    await goToPreviousDay();

    expect(selectedDate()).toBe('2024-01-15');
  });
});
