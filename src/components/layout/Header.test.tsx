import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '../../test/i18n-test-utils';
import {
  mainView,
  resetUiState,
  isPreferencesOpen,
  isStatsOpen,
  isImportOpen,
  isExportOpen,
  isGoToDateOpen,
  selectedDate,
  setSelectedDate,
} from '../../state/ui';

import Header from './Header';

const { mockNavigatePreviousDay, mockNavigateNextDay } = vi.hoisted(() => ({
  mockNavigatePreviousDay: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateNextDay: vi.fn<(currentDate: string) => Promise<string>>(),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    navigatePreviousDay: mockNavigatePreviousDay,
    navigateNextDay: mockNavigateNextDay,
  };
});

describe('Header timeline toggle', () => {
  beforeEach(() => {
    resetUiState();
  });

  it('reflects and switches the main view via aria-pressed', async () => {
    renderWithI18n(() => <Header />);

    const toggle = screen.getByTestId('timeline-toggle-button');

    // Default view is the editor: not pressed, labelled "Show timeline".
    expect(mainView()).toBe('editor');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Show timeline');

    fireEvent.click(toggle);

    // Now showing the timeline: pressed, labelled "Show editor".
    await waitFor(() => expect(mainView()).toBe('timeline'));
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Show editor');

    fireEvent.click(toggle);

    await waitFor(() => expect(mainView()).toBe('editor'));
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  // ── TODO-0104: guarded navigation ──

  it('does not change the view when requestMainViewChange resolves false', async () => {
    const uiState = await import('../../state/ui');
    const denySpy = vi.spyOn(uiState, 'requestMainViewChange').mockResolvedValue(false);
    renderWithI18n(() => <Header />);
    const toggle = screen.getByTestId('timeline-toggle-button');

    fireEvent.click(toggle);
    await waitFor(() => expect(denySpy).toHaveBeenCalledWith('timeline'));

    expect(mainView()).toBe('editor');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Header day navigation', () => {
  beforeEach(() => {
    resetUiState();
    setSelectedDate('2024-01-15');
    mockNavigatePreviousDay.mockReset();
    mockNavigateNextDay.mockReset();
  });

  it('drives selectedDate back a day via the ◀ button', async () => {
    mockNavigatePreviousDay.mockResolvedValue('2024-01-14');
    renderWithI18n(() => <Header />);

    fireEvent.click(screen.getByTestId('header-prev-day-button'));

    await waitFor(() => expect(selectedDate()).toBe('2024-01-14'));
    expect(mockNavigatePreviousDay).toHaveBeenCalledWith('2024-01-15');
  });

  it('drives selectedDate forward a day via the ▶ button', async () => {
    mockNavigateNextDay.mockResolvedValue('2024-01-16');
    renderWithI18n(() => <Header />);

    fireEvent.click(screen.getByTestId('header-next-day-button'));

    await waitFor(() => expect(selectedDate()).toBe('2024-01-16'));
    expect(mockNavigateNextDay).toHaveBeenCalledWith('2024-01-15');
  });

  it('opens the Go to Date overlay when the date title is clicked', () => {
    renderWithI18n(() => <Header />);

    expect(isGoToDateOpen()).toBe(false);

    fireEvent.click(screen.getByTestId('header-date-title'));

    expect(isGoToDateOpen()).toBe(true);
  });
});

describe('Header more menu', () => {
  beforeEach(() => {
    resetUiState();
  });

  it('opens Preferences via the overflow menu', async () => {
    const user = userEvent.setup();
    renderWithI18n(() => <Header />);

    expect(isPreferencesOpen()).toBe(false);

    await user.click(screen.getByTestId('header-more-menu-trigger'));

    const preferencesItem = await waitFor(() =>
      screen.getByTestId('header-more-menu-preferences-item'),
    );
    await user.click(preferencesItem);

    await waitFor(() => expect(isPreferencesOpen()).toBe(true));
  });

  // Header does not mount the overlays (MainLayout does), so — as with the
  // Preferences test above — assert the state/ui read signal flips rather than an
  // overlay render.
  it.each([
    ['header-more-menu-statistics-item', isStatsOpen],
    ['header-more-menu-import-item', isImportOpen],
    ['header-more-menu-export-item', isExportOpen],
  ] as const)('opens the overlay for %s', async (itemTestId, isOpen) => {
    const user = userEvent.setup();
    renderWithI18n(() => <Header />);

    expect(isOpen()).toBe(false);

    await user.click(screen.getByTestId('header-more-menu-trigger'));

    const item = await waitFor(() => screen.getByTestId(itemTestId));
    await user.click(item);

    await waitFor(() => expect(isOpen()).toBe(true));
  });
});
