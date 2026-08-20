import { createSignal } from 'solid-js';
import { getTodayString } from '../lib/dates';
import { isConfirmDialogOpen } from './confirm-dialog';
import { requestNavigationConsent } from './entries';

// Selected date (YYYY-MM-DD format)
const [selectedDate, setSelectedDate] = createSignal<string>(getTodayString());

// Deep-link target: the specific entry id to open within its day. A date can hold
// multiple entries (schema v6), so search results set this alongside the date and the
// editor lands on the matching entry instead of the day's newest. One-shot: the editor
// clears it once consumed.
const [selectedEntryId, setSelectedEntryId] = createSignal<number | null>(null);

// Main content view: the editor (default) or the timeline list of all entries
export type MainView = 'editor' | 'timeline';
const [mainView, setMainView] = createSignal<MainView>('editor');

// Sidebar collapsed state — starts collapsed so the editor is visible immediately on launch/unlock
const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(true);

// Go To Date overlay state
const [isGoToDateOpen, setIsGoToDateOpen] = createSignal(false);

// Preferences overlay state
const [isPreferencesOpen, setIsPreferencesOpen] = createSignal(false);

// Statistics overlay state
const [isStatsOpen, setIsStatsOpen] = createSignal(false);

// Import overlay state
const [isImportOpen, setIsImportOpen] = createSignal(false);

// Export overlay state
const [isExportOpen, setIsExportOpen] = createSignal(false);

// About overlay state
const [isAboutOpen, setIsAboutOpen] = createSignal(false);

// Notifications overlay state
const [isNotificationsOpen, setIsNotificationsOpen] = createSignal(false);

// Tag manager overlay state
const [isTagManagerOpen, setIsTagManagerOpen] = createSignal(false);

// Image picker overlay state
const [isImagePickerOpen, setIsImagePickerOpen] = createSignal(false);

// Search overlay state
const [isSearchOpen, setIsSearchOpen] = createSignal(false);

// Header overflow ("more options") menu state — controlled so MainLayout's global
// Escape/search-shortcut guards can detect it and avoid firing underneath it.
const [isMoreMenuOpen, setIsMoreMenuOpen] = createSignal(false);

/**
 * True while any modal overlay owns the screen. Single source of truth for the
 * "don't fire underneath a dialog" guard used by the global Escape handler and by
 * every app-level keyboard shortcut (`src/lib/keyboard-shortcuts.ts`) — overlays
 * handle their own keys, so nothing behind them may react.
 *
 * Every overlay signal in this module belongs here. When you add one, add it here too.
 */
export function isAnyOverlayOpen(): boolean {
  return (
    isGoToDateOpen() ||
    isPreferencesOpen() ||
    isStatsOpen() ||
    isImportOpen() ||
    isExportOpen() ||
    isAboutOpen() ||
    isNotificationsOpen() ||
    isTagManagerOpen() ||
    isImagePickerOpen() ||
    isSearchOpen() ||
    isMoreMenuOpen() ||
    isConfirmDialogOpen()
  );
}

/**
 * Guarded date-change entry point (TODO-0104): asks every registered navigation guard
 * before writing `selectedDate`. Resolves `false` (and leaves the date unchanged) when a
 * guard denies — e.g. the user cancelled the in-app confirm dialog for erased content.
 */
export async function requestDateChange(date: string): Promise<boolean> {
  if (!(await requestNavigationConsent())) return false;
  setSelectedDate(date);
  return true;
}

/** Guarded main-view-change entry point (TODO-0104) — same contract as `requestDateChange`. */
export async function requestMainViewChange(view: MainView): Promise<boolean> {
  if (!(await requestNavigationConsent())) return false;
  setMainView(view);
  return true;
}

/**
 * Guarded combined date+view change (TODO-0104) — for call sites that change both
 * together (Timeline row click, search result click), so the guard fires exactly once
 * for the one user action instead of twice via two separate guarded calls.
 */
export async function requestDateAndViewChange(date: string, view: MainView): Promise<boolean> {
  if (!(await requestNavigationConsent())) return false;
  setSelectedDate(date);
  setMainView(view);
  return true;
}

// resetUiState() bypasses the guard deliberately: it runs during lock cleanup (session.ts),
// which already flushes via registerCleanupCallback and must never wait on a dialog.
export function resetUiState(): void {
  setSelectedDate(getTodayString());
  setSelectedEntryId(null);
  setMainView('editor');
  setIsSidebarCollapsed(true);
  setIsGoToDateOpen(false);
  setIsPreferencesOpen(false);
  setIsStatsOpen(false);
  setIsImportOpen(false);
  setIsExportOpen(false);
  setIsAboutOpen(false);
  setIsNotificationsOpen(false);
  setIsTagManagerOpen(false);
  setIsImagePickerOpen(false);
  setIsSearchOpen(false);
  setIsMoreMenuOpen(false);
}

export {
  selectedDate,
  setSelectedDate,
  selectedEntryId,
  setSelectedEntryId,
  mainView,
  setMainView,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isGoToDateOpen,
  setIsGoToDateOpen,
  isPreferencesOpen,
  setIsPreferencesOpen,
  isStatsOpen,
  setIsStatsOpen,
  isImportOpen,
  setIsImportOpen,
  isExportOpen,
  setIsExportOpen,
  isAboutOpen,
  setIsAboutOpen,
  isNotificationsOpen,
  setIsNotificationsOpen,
  isTagManagerOpen,
  setIsTagManagerOpen,
  isImagePickerOpen,
  setIsImagePickerOpen,
  isSearchOpen,
  setIsSearchOpen,
  isMoreMenuOpen,
  setIsMoreMenuOpen,
};
