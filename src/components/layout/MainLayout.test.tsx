import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { resetUiState, setIsMoreMenuOpen, isSearchOpen } from '../../state/ui';
import { setPreferences, resetPreferences } from '../../state/preferences';

const mockClose = vi.hoisted(() => vi.fn(() => Promise.resolve()));

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
