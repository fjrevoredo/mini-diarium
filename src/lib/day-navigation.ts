import { selectedDate, setSelectedDate } from '../state/ui';
import { preferences } from '../state/preferences';
import {
  navigatePreviousDay,
  navigateNextDay,
  navigateToToday,
  navigatePreviousMonth,
  navigateNextMonth,
} from './tauri';
import { getTodayString } from './dates';
import { createLogger } from './logger';

const log = createLogger('DayNavigation');

/** Clamp a computed date to today when future entries are disabled. */
function clampToToday(date: string): string {
  const today = getTodayString();
  return !preferences().allowFutureEntries && date > today ? today : date;
}

/**
 * Move the selected date to the previous day.
 *
 * Single source of truth for previous-day navigation, shared by the Header ◀ button
 * and the `Mod+[` shortcut (`src/lib/keyboard-shortcuts.ts`).
 */
export async function goToPreviousDay(): Promise<void> {
  try {
    const newDate = await navigatePreviousDay(selectedDate());
    setSelectedDate(newDate);
  } catch (error) {
    log.error('Failed to navigate to previous day:', error);
  }
}

/**
 * Move the selected date to the next day, clamping to today when future entries
 * are disabled (`preferences().allowFutureEntries === false`).
 *
 * Single source of truth for next-day navigation, shared by the Header ▶ button
 * and the `Mod+]` shortcut (`src/lib/keyboard-shortcuts.ts`).
 */
export async function goToNextDay(): Promise<void> {
  try {
    const newDate = await navigateNextDay(selectedDate());
    setSelectedDate(clampToToday(newDate));
  } catch (error) {
    log.error('Failed to navigate to next day:', error);
  }
}

/**
 * Jump the selected date to today. Routes through the `navigate_to_today` backend
 * wrapper (not a local `getTodayString()`) so the app's notion of "today" stays
 * owned by one layer. Bound to `Mod+T`.
 */
export async function goToToday(): Promise<void> {
  try {
    const newDate = await navigateToToday();
    setSelectedDate(newDate);
  } catch (error) {
    log.error('Failed to navigate to today:', error);
  }
}

/**
 * Move the selected date back one month. Bound to `Mod+Shift+[`.
 */
export async function goToPreviousMonth(): Promise<void> {
  try {
    const newDate = await navigatePreviousMonth(selectedDate());
    setSelectedDate(newDate);
  } catch (error) {
    log.error('Failed to navigate to previous month:', error);
  }
}

/**
 * Move the selected date forward one month, clamping to today when future entries
 * are disabled. Bound to `Mod+Shift+]`.
 */
export async function goToNextMonth(): Promise<void> {
  try {
    const newDate = await navigateNextMonth(selectedDate());
    setSelectedDate(clampToToday(newDate));
  } catch (error) {
    log.error('Failed to navigate to next month:', error);
  }
}
