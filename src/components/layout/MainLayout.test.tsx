import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { mockTauriBarrel } from '../../test/mock-tauri';
import {
  resetUiState,
  setIsMoreMenuOpen,
  isLinkDialogOpen,
  setIsLinkDialogOpen,
  isTimestampDialogOpen,
  setIsTimestampDialogOpen,
  isSearchOpen,
  isPreferencesOpen,
  selectedDate,
  setSelectedDate,
} from '../../state/ui';
import { setPreferences, resetPreferences } from '../../state/preferences';
import { setEntryDates } from '../../state/entries';

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

import { delegateEvents } from 'solid-js/web';
import type { Editor } from '@tiptap/core';
import MainLayout from './MainLayout';
import LinkOverlay from '../editor/LinkOverlay';
import TimestampOverlay from '../editor/TimestampOverlay';

// In the app bundle, modules with a native `onKeyDown` (e.g. EntryTags) register Solid's
// delegated keydown listener on `document` at import time, before MainLayout mounts.
// Do the same here so the handler order matches the app.
delegateEvents(['keydown']);

// Just enough of an Editor for the dialogs to open and close; no insert runs.
const dialogEditor = {
  isActive: () => false,
  getAttributes: () => ({}),
  state: { selection: { empty: true, from: 0, to: 0 }, doc: { textBetween: () => '' } },
} as unknown as Editor;

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

  it.each([
    ['Insert Link', setIsLinkDialogOpen],
    ['Insert Timestamp', setIsTimestampDialogOpen],
  ] as const)('does not quit on Escape while the %s dialog is open', (_name, setOpen) => {
    setPreferences({ escAction: 'quit' });
    setOpen(true);
    renderWithI18n(() => <MainLayout />);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(mockClose).not.toHaveBeenCalled();
  });

  // The real dialogs close themselves from a delegated onKeyDown, which Solid runs on
  // `document` before handleGlobalEsc (see delegateEvents above). The guard must still
  // see that a dialog owned this Escape.
  it.each([
    ['Insert Link', LinkOverlay, isLinkDialogOpen, setIsLinkDialogOpen],
    ['Insert Timestamp', TimestampOverlay, isTimestampDialogOpen, setIsTimestampDialogOpen],
  ] as const)(
    'does not quit when Escape closes the real %s dialog',
    (_name, Overlay, isOpen, setOpen) => {
      setPreferences({ escAction: 'quit' });
      renderWithI18n(() => <MainLayout />);
      renderWithI18n(() => (
        <Overlay editor={dialogEditor} isOpen={isOpen()} onClose={() => setOpen(false)} />
      ));
      setOpen(true);

      const dialog = document.querySelector('[role="dialog"]')!;
      dialog.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      expect(isOpen()).toBe(false);
      expect(mockClose).not.toHaveBeenCalled();
    },
  );

  it('does not quit on Escape that cancels an IME composition', () => {
    setPreferences({ escAction: 'quit' });
    renderWithI18n(() => <MainLayout />);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }),
    );

    expect(mockClose).not.toHaveBeenCalled();
  });

  it('does not quit on Escape that a component already handled (defaultPrevented)', () => {
    setPreferences({ escAction: 'quit' });
    renderWithI18n(() => <MainLayout />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(mockClose).not.toHaveBeenCalled();
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

describe('MainLayout navigation wiring', () => {
  beforeEach(() => {
    resetUiState();
    resetPreferences();
    eventMocks.listeners.clear();
    eventMocks.navigatePreviousDay.mockReset();
    setEntryDates([]);
  });

  afterEach(() => {
    resetUiState();
    resetPreferences();
  });

  it('previous-entry-day shortcut navigates from the CURRENT selected date, not the initial one', async () => {
    setEntryDates(['2024-01-10', '2024-01-19', '2024-01-25']);

    renderWithI18n(() => <MainLayout />);

    // The user changes the selected date AFTER the shortcut handler was registered.
    setSelectedDate('2024-01-20');

    // Ctrl+[ — the handler must read selectedDate() at call time, not at mount.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '[', code: 'BracketLeft', ctrlKey: true, bubbles: true }),
    );

    await waitFor(() => expect(selectedDate()).toBe('2024-01-19'));
    expect(eventMocks.navigatePreviousDay).not.toHaveBeenCalled();
  });

  it('registers the surviving menu-preferences listener and opens Preferences', async () => {
    renderWithI18n(() => <MainLayout />);

    // onMount registers the listener asynchronously.
    await waitFor(() => expect(eventMocks.listeners.has('menu-preferences')).toBe(true));

    expect(isPreferencesOpen()).toBe(false);
    await eventMocks.listeners.get('menu-preferences')!(undefined);

    expect(isPreferencesOpen()).toBe(true);
  });
});
