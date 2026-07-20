import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '../../test/i18n-test-utils';
import {
  mainView,
  resetUiState,
  isPreferencesOpen,
  isGoToDateOpen,
  selectedDate,
  setSelectedDate,
} from '../../state/ui';
import { setFeatureFlag } from '../../state/feature-flags';

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

  it('reflects and switches the main view via aria-pressed', () => {
    renderWithI18n(() => <Header />);

    const toggle = screen.getByTestId('timeline-toggle-button');

    // Default view is the editor: not pressed, labelled "Show timeline".
    expect(mainView()).toBe('editor');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Show timeline');

    fireEvent.click(toggle);

    // Now showing the timeline: pressed, labelled "Show editor".
    expect(mainView()).toBe('timeline');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Show editor');

    fireEvent.click(toggle);

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
    localStorage.clear();
    setFeatureFlag('inAppMenu', false);
  });

  afterEach(() => {
    setFeatureFlag('inAppMenu', false);
    localStorage.clear();
  });

  it('hides the ⋮ overflow menu entirely when the inAppMenu flag is off', () => {
    renderWithI18n(() => <Header />);

    expect(screen.queryByTestId('header-more-menu-trigger')).not.toBeInTheDocument();
  });

  it('opens Preferences via the overflow menu when the inAppMenu flag is on', async () => {
    setFeatureFlag('inAppMenu', true);
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
});
