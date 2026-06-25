import { createSignal } from 'solid-js';
import { getTodayString } from '../lib/dates';

// Selected date (YYYY-MM-DD format)
const [selectedDate, setSelectedDate] = createSignal<string>(getTodayString());

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

export function resetUiState(): void {
  setSelectedDate(getTodayString());
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
}

export {
  selectedDate,
  setSelectedDate,
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
};
