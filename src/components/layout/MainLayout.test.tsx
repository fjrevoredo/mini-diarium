import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { mockTauriBarrel } from '../../test/mock-tauri';
import {
  resetUiState,
  setIsMoreMenuOpen,
  isSearchOpen,
  selectedDate,
  setSelectedDate,
} from '../../state/ui';
import { setPreferences, resetPreferences } from '../../state/preferences';

const mockClose = vi.hoisted(() => vi.fn(() => Promise.resolve()));

// Capture the real menu-event handlers MainLayout registers via listen(), and
// stub the navigation wrapper so we can assert the date it is invoked with.
const eventMocks = vi.hoisted(() => ({
  navigatePreviousDay: vi.fn(),
  listeners: new Map<string, (event: unknown) => void | Promise<void>>(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, handler: (e: unknown) => void | Promise<void>) => {
    eventMocks.listeners.set(event, handler);
    return () => eventMocks.listeners.delete(event);
  }),
  emit: vi.fn(async () => {}),
}));

vi.mock('../../lib/tauri', () =>
  mockTauriBarrel({ navigatePreviousDay: eventMocks.navigatePreviousDay }),
);

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: mockClose }),
}));

// Isolate MainLayout's own keydown-guard logic from its heavy child tree
// (editor, sidebar, calendar, overlays) — none of it is relevant here.
vi.mock('./Header', () => ({ default: () => null }));
vi.mock('./Sidebar', () => ({ default: () => null }));
vi.mock('./EditorPanel', () => ({ default: () => null }));
vi.mock('../timeline/Timeline', () => ({ default: () => null }));
vi.mock('../overlays/GoToDateOverlay', () => ({ default: () => null }));
vi.mock('../overlays/preferences/PreferencesOverlay', () => ({ default: () => null }));
vi.mock('../overlays/StatsOverlay', () => ({ default: () => null }));
vi.mock('../overlays/ImportOverlay', () => ({ default: () => null }));
vi.mock('../overlays/ExportOverlay', () => ({ default: () => null }));
vi.mock('../overlays/NotificationsOverlay', () => ({ default: () => null }));
vi.mock('../overlays/TagManager', () => ({ default: () => null }));
vi.mock('../overlays/OnboardingOverlay', () => ({ default: () => null }));
vi.mock('../search/SearchOverlay', () => ({ default: () => null }));

import MainLayout from './MainLayout';

describe('MainLayout global keydown guards', () => {
  beforeEach(() => {
    resetUiState();
    resetPreferences();
    mockClose.mockClear();
  });

  afterEach(() => {
    resetUiState();
    resetPreferences();
  });

  it('does not quit on Escape while the header overflow menu is open', () => {
    setPreferences({ escAction: 'quit' });
    setIsMoreMenuOpen(true);
    renderWithI18n(() => <MainLayout />);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(mockClose).not.toHaveBeenCalled();
  });

  it('quits on Escape when no overlay or menu is open', () => {
    setPreferences({ escAction: 'quit' });
    renderWithI18n(() => <MainLayout />);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('does not open search on Ctrl+F while the header overflow menu is open', () => {
    setIsMoreMenuOpen(true);
    renderWithI18n(() => <MainLayout />);

    expect(isSearchOpen()).toBe(false);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }),
    );

    expect(isSearchOpen()).toBe(false);
  });
});

describe('MainLayout menu navigation', () => {
  beforeEach(() => {
    resetUiState();
    resetPreferences();
    eventMocks.listeners.clear();
    eventMocks.navigatePreviousDay.mockReset();
  });

  afterEach(() => {
    resetUiState();
    resetPreferences();
  });

  it('previous-day handler navigates from the CURRENT selected date, not the initial one', async () => {
    eventMocks.navigatePreviousDay.mockResolvedValue('2024-01-19');

    renderWithI18n(() => <MainLayout />);

    // onMount registers the listeners asynchronously.
    await waitFor(() => expect(eventMocks.listeners.has('menu-navigate-previous-day')).toBe(true));

    // The user changes the selected date AFTER the listener was registered.
    setSelectedDate('2024-01-20');

    // Fire the menu event; the handler must read selectedDate() at call time.
    await eventMocks.listeners.get('menu-navigate-previous-day')!(undefined);

    expect(eventMocks.navigatePreviousDay).toHaveBeenCalledWith('2024-01-20');
    await waitFor(() => expect(selectedDate()).toBe('2024-01-19'));
  });
});
