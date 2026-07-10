import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import * as uiState from '../../state/ui';
import * as entriesState from '../../state/entries';
import * as tagsState from '../../state/tags';
import * as prefsState from '../../state/preferences';
import type { Preferences } from '../../state/preferences';
import * as datesLib from '../../lib/dates';
import Calendar from './Calendar';

const PREFS_STUB = {
  allowFutureEntries: false,
  firstDayOfWeek: 0,
  language: 'en',
} as unknown as Preferences;

describe('Calendar', () => {
  beforeEach(() => {
    uiState.setSelectedDate('2026-05-17');
    entriesState.setEntryDates([]);
    vi.spyOn(tagsState, 'tagFilteredDates').mockReturnValue(null);
    vi.spyOn(prefsState, 'preferences').mockReturnValue(PREFS_STUB);
    vi.spyOn(datesLib, 'getTodayString').mockReturnValue('2026-05-17');
  });

  afterEach(() => {
    entriesState.setEntryDates([]);
    entriesState.setLockedDates([]);
    vi.restoreAllMocks();
  });

  it('renders 42 day buttons (6 weeks × 7 days)', () => {
    renderWithI18n(() => <Calendar />);
    expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(42);
  });

  it("today's button has aria-current='date'", () => {
    renderWithI18n(() => <Calendar />);
    expect(screen.getByTestId('calendar-day-2026-05-17')).toHaveAttribute('aria-current', 'date');
  });

  it('the selected date button has aria-selected="true"', () => {
    renderWithI18n(() => <Calendar />);
    expect(screen.getByTestId('calendar-day-2026-05-17')).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a non-disabled day updates selectedDate', () => {
    renderWithI18n(() => <Calendar />);
    // May 1, 2026 is a past, non-selected, non-disabled day
    fireEvent.click(screen.getByTestId('calendar-day-2026-05-01'));
    expect(uiState.selectedDate()).toBe('2026-05-01');
  });

  it('a date in entryDates has an aria-label containing the has-entry indicator', () => {
    entriesState.setEntryDates(['2026-05-10']);
    renderWithI18n(() => <Calendar />);
    const btn = screen.getByTestId('calendar-day-2026-05-10');
    expect(btn.getAttribute('aria-label')).toContain(', has entry');
  });

  it('a date in lockedDates shows the lock glyph and has-locked-entry aria fragment', () => {
    entriesState.setLockedDates(['2026-05-12']);
    renderWithI18n(() => <Calendar />);
    const btn = screen.getByTestId('calendar-day-2026-05-12');
    expect(btn.getAttribute('aria-label')).toContain(', has locked entry');
    expect(screen.getByTestId('calendar-lock-2026-05-12')).toBeInTheDocument();
    // A non-locked day has no glyph.
    expect(screen.queryByTestId('calendar-lock-2026-05-13')).toBeNull();
  });

  it('clicking Previous Month changes the displayed month header', () => {
    renderWithI18n(() => <Calendar />);
    const toggleBtn = screen.getByRole('button', { name: 'Open month picker' });
    expect(toggleBtn.textContent).toMatch(/may/i);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(toggleBtn.textContent).toMatch(/april/i);
  });

  it('clicking the month/year toggle switches to the 12-month picker grid', () => {
    renderWithI18n(() => <Calendar />);
    fireEvent.click(screen.getByRole('button', { name: 'Open month picker' }));
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach(
      (abbrev) => expect(screen.getByText(abbrev)).toBeInTheDocument(),
    );
  });

  it('future dates are disabled when allowFutureEntries is false', () => {
    renderWithI18n(() => <Calendar />);
    // May 18, 2026 is the day after today ('2026-05-17')
    expect(screen.getByTestId('calendar-day-2026-05-18')).toBeDisabled();
  });

  it('updating entryDates after mount shows the entry dot without remounting day buttons', async () => {
    renderWithI18n(() => <Calendar />);
    const btnBefore = screen.getByTestId('calendar-day-2026-05-10');
    expect(btnBefore.querySelector('[aria-hidden="true"].rounded-full')).toBeNull();

    entriesState.setEntryDates(['2026-05-10']);
    await Promise.resolve();

    const btnAfter = screen.getByTestId('calendar-day-2026-05-10');
    // Same DOM node identity — proves the <For> grid did not tear down/remount on data change.
    expect(btnAfter).toBe(btnBefore);
    expect(btnAfter.querySelector('[aria-hidden="true"].rounded-full')).not.toBeNull();
  });

  it('selection highlight follows clicks without remounting day buttons (same month)', () => {
    renderWithI18n(() => <Calendar />);
    const oldSelected = screen.getByTestId('calendar-day-2026-05-17');
    const newSelected = screen.getByTestId('calendar-day-2026-05-01');
    expect(oldSelected).toHaveAttribute('aria-selected', 'true');
    expect(newSelected).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(newSelected);

    // Same DOM nodes — the highlight moved via the inline-reactive isSelected() read,
    // not via a <For> remount.
    expect(screen.getByTestId('calendar-day-2026-05-17')).toBe(oldSelected);
    expect(screen.getByTestId('calendar-day-2026-05-01')).toBe(newSelected);
    expect(oldSelected).toHaveAttribute('aria-selected', 'false');
    expect(newSelected).toHaveAttribute('aria-selected', 'true');
  });
});
