import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  goToPreviousDay,
  goToNextDay,
  goToToday,
  goToPreviousMonth,
  goToNextMonth,
} from './day-navigation';
import { selectedDate, setSelectedDate } from '../state/ui';
import { setPreferences } from '../state/preferences';
import { getTodayString, addDays } from './dates';

const {
  mockNavigatePreviousDay,
  mockNavigateNextDay,
  mockNavigateToToday,
  mockNavigatePreviousMonth,
  mockNavigateNextMonth,
} = vi.hoisted(() => ({
  mockNavigatePreviousDay: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateNextDay: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateToToday: vi.fn<() => Promise<string>>(),
  mockNavigatePreviousMonth: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateNextMonth: vi.fn<(currentDate: string) => Promise<string>>(),
}));

vi.mock('./tauri', async () => {
  const actual = await vi.importActual<typeof import('./tauri')>('./tauri');
  return {
    ...actual,
    navigatePreviousDay: mockNavigatePreviousDay,
    navigateNextDay: mockNavigateNextDay,
    navigateToToday: mockNavigateToToday,
    navigatePreviousMonth: mockNavigatePreviousMonth,
    navigateNextMonth: mockNavigateNextMonth,
  };
});

describe('day-navigation', () => {
  beforeEach(() => {
    mockNavigatePreviousDay.mockReset();
    mockNavigateNextDay.mockReset();
    mockNavigateToToday.mockReset();
    mockNavigatePreviousMonth.mockReset();
    mockNavigateNextMonth.mockReset();
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

  it('goToToday sets selectedDate to the backend-resolved today', async () => {
    setSelectedDate('2024-01-15');
    mockNavigateToToday.mockResolvedValue('2026-07-25');

    await goToToday();

    expect(mockNavigateToToday).toHaveBeenCalledTimes(1);
    expect(selectedDate()).toBe('2026-07-25');
  });

  it('goToToday leaves selectedDate unchanged when the backend rejects', async () => {
    setSelectedDate('2024-01-15');
    mockNavigateToToday.mockRejectedValue(new Error('boom'));

    await goToToday();

    expect(selectedDate()).toBe('2024-01-15');
  });

  it('goToPreviousMonth sets selectedDate to the backend-resolved previous month', async () => {
    setSelectedDate('2024-03-15');
    mockNavigatePreviousMonth.mockResolvedValue('2024-02-15');

    await goToPreviousMonth();

    expect(mockNavigatePreviousMonth).toHaveBeenCalledWith('2024-03-15');
    expect(selectedDate()).toBe('2024-02-15');
  });

  it('goToPreviousMonth leaves selectedDate unchanged when the backend rejects', async () => {
    setSelectedDate('2024-03-15');
    mockNavigatePreviousMonth.mockRejectedValue(new Error('boom'));

    await goToPreviousMonth();

    expect(selectedDate()).toBe('2024-03-15');
  });

  it('goToNextMonth sets selectedDate to the backend-resolved next month', async () => {
    setPreferences({ allowFutureEntries: true });
    setSelectedDate('2024-01-15');
    mockNavigateNextMonth.mockResolvedValue('2024-02-15');

    await goToNextMonth();

    expect(mockNavigateNextMonth).toHaveBeenCalledWith('2024-01-15');
    expect(selectedDate()).toBe('2024-02-15');
  });

  it('goToNextMonth clamps to today when future entries are disabled', async () => {
    setPreferences({ allowFutureEntries: false });
    const today = getTodayString();
    const nextMonth = addDays(today, 30);
    setSelectedDate(today);
    mockNavigateNextMonth.mockResolvedValue(nextMonth);

    await goToNextMonth();

    expect(selectedDate()).toBe(today);
  });

  it('goToNextMonth does not clamp a past result when future entries are disabled', async () => {
    setPreferences({ allowFutureEntries: false });
    setSelectedDate('2024-01-15');
    mockNavigateNextMonth.mockResolvedValue('2024-02-15');

    await goToNextMonth();

    expect(selectedDate()).toBe('2024-02-15');
  });

  it('goToNextMonth leaves selectedDate unchanged when the backend rejects', async () => {
    setPreferences({ allowFutureEntries: true });
    setSelectedDate('2024-01-15');
    mockNavigateNextMonth.mockRejectedValue(new Error('boom'));

    await goToNextMonth();

    expect(selectedDate()).toBe('2024-01-15');
  });
});
