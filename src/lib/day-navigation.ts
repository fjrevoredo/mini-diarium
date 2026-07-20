import { selectedDate, setSelectedDate } from '../state/ui';
import { preferences } from '../state/preferences';
import { navigatePreviousDay, navigateNextDay } from './tauri';
import { getTodayString } from './dates';
import { createLogger } from './logger';

const log = createLogger('DayNavigation');

/**
 * Move the selected date to the previous day.
 *
 * Single source of truth for previous-day navigation, shared by the native menu
 * listener (`menu-navigate-previous-day` in MainLayout) and the Header ◀ button.
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
 * Single source of truth for next-day navigation, shared by the native menu
 * listener (`menu-navigate-next-day` in MainLayout) and the Header ▶ button.
 */
export async function goToNextDay(): Promise<void> {
  try {
    const newDate = await navigateNextDay(selectedDate());
    // Clamp to today if future entries are not allowed
    const today = getTodayString();
    const finalDate = !preferences().allowFutureEntries && newDate > today ? today : newDate;
    setSelectedDate(finalDate);
  } catch (error) {
    log.error('Failed to navigate to next day:', error);
  }
}
