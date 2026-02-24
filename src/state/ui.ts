import { createSignal } from 'solid-js';
import { getTodayString } from '../lib/dates';

// Selected date (YYYY-MM-DD format)
const [selectedDate, setSelectedDate] = createSignal<string>(getTodayString());

// Sidebar collapsed state (for mobile)
const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(false);

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

export function resetUiState(): void {
  setSelectedDate(getTodayString());
  setIsSidebarCollapsed(false);
  setIsGoToDateOpen(false);
  setIsPreferencesOpen(false);
  setIsStatsOpen(false);
  setIsImportOpen(false);
  setIsExportOpen(false);
  setIsAboutOpen(false);
}

export {
  selectedDate,
  setSelectedDate,
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
};
