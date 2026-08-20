import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import * as uiState from '../../state/ui';
import * as datesLib from '../../lib/dates';
import * as prefsState from '../../state/preferences';
import type { Preferences } from '../../state/preferences';
import GoToDateOverlay from './GoToDateOverlay';

describe('GoToDateOverlay', () => {
  beforeEach(() => {
    uiState.setIsGoToDateOpen(true);
    uiState.setSelectedDate('2026-01-15');
    vi.spyOn(datesLib, 'getTodayString').mockReturnValue('2026-01-15');
    vi.spyOn(prefsState, 'preferences').mockReturnValue({
      allowFutureEntries: false,
    } as Preferences);
  });

  afterEach(() => {
    uiState.setIsGoToDateOpen(false);
    vi.restoreAllMocks();
  });

  it('renders the dialog title when isGoToDateOpen is true', () => {
    renderWithI18n(() => <GoToDateOverlay />);
    expect(screen.getByRole('heading', { name: 'Go to Date' })).toBeInTheDocument();
  });

  it('pre-fills the date input with the current selectedDate value', () => {
    renderWithI18n(() => <GoToDateOverlay />);
    const input = screen.getByLabelText('Select Date') as HTMLInputElement;
    expect(input.value).toBe('2026-01-15');
  });

  it('submit is disabled for an invalid date format', () => {
    renderWithI18n(() => <GoToDateOverlay />);
    const input = screen.getByLabelText('Select Date');
    fireEvent.input(input, { target: { value: 'not-a-date' } });
    expect(screen.getByRole('button', { name: 'Go to Date' })).toBeDisabled();
  });

  it('submit is disabled when the input date equals the current selectedDate', () => {
    renderWithI18n(() => <GoToDateOverlay />);
    // Input pre-fills to selectedDate ('2026-01-15') — no change means no navigation
    expect(screen.getByRole('button', { name: 'Go to Date' })).toBeDisabled();
  });

  it('submit is disabled for a future date when allowFutureEntries is false', () => {
    vi.spyOn(datesLib, 'getTodayString').mockReturnValue('2026-01-14');
    renderWithI18n(() => <GoToDateOverlay />);
    const input = screen.getByLabelText('Select Date');
    // '2026-01-16' is after today and different from selectedDate
    fireEvent.input(input, { target: { value: '2026-01-16' } });
    expect(screen.getByRole('button', { name: 'Go to Date' })).toBeDisabled();
  });

  it('submit is enabled for a future date when allowFutureEntries is true', () => {
    vi.spyOn(datesLib, 'getTodayString').mockReturnValue('2026-01-14');
    vi.spyOn(prefsState, 'preferences').mockReturnValue({
      allowFutureEntries: true,
    } as Preferences);
    renderWithI18n(() => <GoToDateOverlay />);
    const input = screen.getByLabelText('Select Date');
    fireEvent.input(input, { target: { value: '2026-01-16' } });
    expect(screen.getByRole('button', { name: 'Go to Date' })).not.toBeDisabled();
  });

  it('submit navigates to the new date and closes the dialog on a valid change', async () => {
    renderWithI18n(() => <GoToDateOverlay />);
    const input = screen.getByLabelText('Select Date');
    // '2026-01-14' is valid, different from selectedDate, and not a future date
    fireEvent.input(input, { target: { value: '2026-01-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Date' }));
    await waitFor(() => expect(uiState.selectedDate()).toBe('2026-01-14'));
    expect(uiState.isGoToDateOpen()).toBe(false);
  });

  it('cancel button closes the dialog', () => {
    renderWithI18n(() => <GoToDateOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(uiState.isGoToDateOpen()).toBe(false);
  });

  // ── TODO-0104: guarded navigation ──

  it('submit leaves the overlay open and does not close it when requestDateChange denies', async () => {
    const denySpy = vi.spyOn(uiState, 'requestDateChange').mockResolvedValue(false);
    renderWithI18n(() => <GoToDateOverlay />);
    const input = screen.getByLabelText('Select Date');
    fireEvent.input(input, { target: { value: '2026-01-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Date' }));

    await waitFor(() => expect(denySpy).toHaveBeenCalledWith('2026-01-14'));
    expect(uiState.isGoToDateOpen()).toBe(true);
    // The user's typed date is still in the input — the overlay was not reset.
    expect((screen.getByLabelText('Select Date') as HTMLInputElement).value).toBe('2026-01-14');
  });
});
