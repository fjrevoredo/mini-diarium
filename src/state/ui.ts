import { createSignal } from 'solid-js';

// Selected date (YYYY-MM-DD format)
const [selectedDate, setSelectedDate] = createSignal<string>(
  new Date().toISOString().split('T')[0],
);

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
