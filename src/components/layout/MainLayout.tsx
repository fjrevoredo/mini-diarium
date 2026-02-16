import { createSignal, onMount, onCleanup } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { createLogger } from '../../lib/logger';
import Header from './Header';
import Sidebar from './Sidebar';
import EditorPanel from './EditorPanel';
import GoToDateOverlay from '../overlays/GoToDateOverlay';
import PreferencesOverlay from '../overlays/PreferencesOverlay';
import StatsOverlay from '../overlays/StatsOverlay';
import ImportOverlay from '../overlays/ImportOverlay';
import ExportOverlay from '../overlays/ExportOverlay';
import {
  selectedDate,
  setSelectedDate,
  setIsGoToDateOpen,
  isPreferencesOpen,
  setIsPreferencesOpen,
  isStatsOpen,
  setIsStatsOpen,
  isImportOpen,
  setIsImportOpen,
  isExportOpen,
  setIsExportOpen,
} from '../../state/ui';
import { setupNavigationShortcuts } from '../../lib/shortcuts';
import {
  navigatePreviousDay,
  navigateNextDay,
  navigateToToday,
  navigatePreviousMonth,
  navigateNextMonth,
} from '../../lib/tauri';
import { preferences } from '../../state/preferences';
import { getTodayString } from '../../lib/dates';

const log = createLogger('MainLayout');

export default function MainLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(true);

  // Store cleanup functions at component level
  let cleanupShortcuts: (() => void) | undefined;
  const unlisteners: UnlistenFn[] = [];

  // Setup keyboard shortcuts and menu listeners
  onMount(async () => {
    // Setup keyboard shortcuts
    cleanupShortcuts = setupNavigationShortcuts(selectedDate, setSelectedDate);

    // Setup menu event listeners
    // Previous Day menu item
    unlisteners.push(
      await listen('menu-navigate-previous-day', async () => {
        try {
          const newDate = await navigatePreviousDay(selectedDate());
          setSelectedDate(newDate);
        } catch (error) {
          log.error('Failed to navigate to previous day:', error);
        }
      }),
    );

    // Next Day menu item
    unlisteners.push(
      await listen('menu-navigate-next-day', async () => {
        try {
          const newDate = await navigateNextDay(selectedDate());
          // Clamp to today if future entries are not allowed
          const today = getTodayString();
          const finalDate = !preferences().allowFutureEntries && newDate > today ? today : newDate;
          setSelectedDate(finalDate);
        } catch (error) {
          log.error('Failed to navigate to next day:', error);
        }
      }),
    );

    // Go to Today menu item
    unlisteners.push(
      await listen('menu-navigate-to-today', async () => {
        try {
          const newDate = await navigateToToday();
          setSelectedDate(newDate);
        } catch (error) {
          log.error('Failed to navigate to today:', error);
        }
      }),
    );

    // Go to Date menu item
    unlisteners.push(
      await listen('menu-go-to-date', () => {
        setIsGoToDateOpen(true);
      }),
    );

    // Preferences menu item
    unlisteners.push(
      await listen('menu-preferences', () => {
        setIsPreferencesOpen(true);
      }),
    );

    // Statistics menu item
    unlisteners.push(
      await listen('menu-statistics', () => {
        setIsStatsOpen(true);
      }),
    );

    // Import menu item
    unlisteners.push(
      await listen('menu-import', () => {
        setIsImportOpen(true);
      }),
    );

    // Export menu item
    unlisteners.push(
      await listen('menu-export', () => {
        setIsExportOpen(true);
      }),
    );

    // Previous Month menu item
    unlisteners.push(
      await listen('menu-navigate-previous-month', async () => {
        try {
          const newDate = await navigatePreviousMonth(selectedDate());
          setSelectedDate(newDate);
        } catch (error) {
          log.error('Failed to navigate to previous month:', error);
        }
      }),
    );

    // Next Month menu item
    unlisteners.push(
      await listen('menu-navigate-next-month', async () => {
        try {
          const newDate = await navigateNextMonth(selectedDate());
          // Clamp to today if future entries are not allowed
          const today = getTodayString();
          const finalDate = !preferences().allowFutureEntries && newDate > today ? today : newDate;
          setSelectedDate(finalDate);
        } catch (error) {
          log.error('Failed to navigate to next month:', error);
        }
      }),
    );
  });

  // Cleanup on component unmount
  onCleanup(() => {
    cleanupShortcuts?.();
    unlisteners.forEach((unlisten) => unlisten());
  });

  return (
    <div class="flex h-screen overflow-hidden bg-secondary">
      {/* Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed()} onClose={() => setIsSidebarCollapsed(true)} />

      {/* Main content area */}
      <div class="flex flex-1 flex-col">
        {/* Header */}
        <Header showMenu onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed())} />

        {/* Editor panel */}
        <main class="flex-1 overflow-hidden">
          <EditorPanel />
        </main>
      </div>

      {/* Overlays */}
      <GoToDateOverlay />
      <PreferencesOverlay
        isOpen={isPreferencesOpen()}
        onClose={() => setIsPreferencesOpen(false)}
      />
      <StatsOverlay isOpen={isStatsOpen()} onClose={() => setIsStatsOpen(false)} />
      <ImportOverlay
        isOpen={isImportOpen()}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={() => {
          // Sidebar will auto-refresh calendar dates via its own effect
          // Just notify user visually that import succeeded (already in overlay)
        }}
      />
      <ExportOverlay isOpen={isExportOpen()} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
