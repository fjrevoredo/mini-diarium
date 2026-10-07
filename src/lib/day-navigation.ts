import { selectedDate, requestDateChange } from '../state/ui';
import { preferences } from '../state/preferences';
import { entryDates } from '../state/entries';
import { tagFilteredDates } from '../state/tags';
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
 * Dates the entry-day shortcuts may land on. Same expression the Calendar uses for its
 * entry dots, so the shortcut and the dots always agree (including under a tag filter).
 */
function candidateEntryDates(): string[] {
  return tagFilteredDates() ?? entryDates();
}

/** Move to `target` through the navigation guard; a null target means "stay put". */
async function moveToEntryDay(target: string | null): Promise<void> {
  if (target === null) return;
  try {
    await requestDateChange(target);
  } catch (error) {
    log.error('Failed to navigate to entry day:', error);
  }
}

/**
 * Jump to the closest earlier day that has an entry. Does nothing when there is none.
 * Bound to `Mod+[`; the Header ◀ button steps one calendar day instead.
 */
export async function goToPreviousEntryDay(): Promise<void> {
  const current = selectedDate();
  let target: string | null = null;
  for (const d of candidateEntryDates()) {
    if (d < current && (target === null || d > target)) target = d;
  }
  await moveToEntryDay(target);
}

/**
 * Jump to the closest later day that has an entry. Does nothing when there is none.
 * No `clampToToday`: the target is an existing entry, so showing it is always safe.
 * Bound to `Mod+]`; the Header ▶ button steps one calendar day instead.
 */
export async function goToNextEntryDay(): Promise<void> {
  const current = selectedDate();
  let target: string | null = null;
  for (const d of candidateEntryDates()) {
    if (d > current && (target === null || d < target)) target = d;
  }
  await moveToEntryDay(target);
}

/**
 * Move the selected date to the previous calendar day.
 *
 * Used by the Header ◀ button. The `Mod+[` shortcut uses `goToPreviousEntryDay`.
 */
export async function goToPreviousDay(): Promise<void> {
  try {
    const newDate = await navigatePreviousDay(selectedDate());
    await requestDateChange(newDate);
  } catch (error) {
    log.error('Failed to navigate to previous day:', error);
  }
}

/**
 * Move the selected date to the next day, clamping to today when future entries
 * are disabled (`preferences().allowFutureEntries === false`).
 *
 * Used by the Header ▶ button. The `Mod+]` shortcut uses `goToNextEntryDay`.
 */
export async function goToNextDay(): Promise<void> {
  try {
    const newDate = await navigateNextDay(selectedDate());
    await requestDateChange(clampToToday(newDate));
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
    await requestDateChange(newDate);
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
    await requestDateChange(newDate);
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
    await requestDateChange(clampToToday(newDate));
  } catch (error) {
    log.error('Failed to navigate to next month:', error);
  }
}
