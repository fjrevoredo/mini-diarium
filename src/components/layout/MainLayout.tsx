import { onMount, onCleanup, Show } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createLogger } from '../../lib/logger';
import Header from './Header';
import Sidebar from './Sidebar';
import EditorPanel from './EditorPanel';
import Timeline from '../timeline/Timeline';
import GoToDateOverlay from '../overlays/GoToDateOverlay';
import PreferencesOverlay from '../overlays/preferences/PreferencesOverlay';
import StatsOverlay from '../overlays/StatsOverlay';
import ImportOverlay from '../overlays/ImportOverlay';
import ExportOverlay from '../overlays/ExportOverlay';
import NotificationsOverlay from '../overlays/NotificationsOverlay';
import TagManager from '../overlays/TagManager';
import OnboardingTour from '../overlays/OnboardingOverlay';
import SearchOverlay from '../search/SearchOverlay';
import {
  selectedDate,
  setSelectedDate,
  mainView,
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
  isNotificationsOpen,
  isTagManagerOpen,
  setIsTagManagerOpen,
  isSearchOpen,
  setIsSearchOpen,
  isMoreMenuOpen,
} from '../../state/ui';
import { navigateToToday, navigatePreviousMonth, navigateNextMonth } from '../../lib/tauri';
import { preferences } from '../../state/preferences';
import { getTodayString } from '../../lib/dates';
import { goToPreviousDay, goToNextDay } from '../../lib/day-navigation';
import { onboardingMode, minimizeOnboarding } from '../../state/onboarding';

const log = createLogger('MainLayout');

export default function MainLayout() {
  // Store cleanup functions at component level
  const unlisteners: UnlistenFn[] = [];

  const handleGlobalEsc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (onboardingMode() === 'tour') {
      minimizeOnboarding();
      return;
    }
    if (onboardingMode() === 'minimized') return;
    // Never fire when any dialog is open — they handle their own Escape
    if (
      isGoToDateOpen() ||
      isPreferencesOpen() ||
      isStatsOpen() ||
      isImportOpen() ||
      isExportOpen() ||
      isAboutOpen() ||
      isNotificationsOpen() ||
      isTagManagerOpen() ||
      isSearchOpen() ||
      isMoreMenuOpen()
    )
      return;
    if (preferences().escAction === 'quit') {
      getCurrentWindow()
        .close()
        .catch((err) => log.error('Failed to close window:', err));
    }
  };

  // Open the search overlay on Cmd/Ctrl+F. The webview has no native find-in-page, and
  // no editor command uses this combo, so it is safe to claim app-wide. Suppress default
  // to stop any platform find behavior, and bail when another overlay is already open.
  const handleSearchShortcut = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return;
    if (
      isGoToDateOpen() ||
      isPreferencesOpen() ||
      isStatsOpen() ||
      isImportOpen() ||
      isExportOpen() ||
      isAboutOpen() ||
      isNotificationsOpen() ||
      isTagManagerOpen() ||
      isMoreMenuOpen()
    )
      return;
    e.preventDefault();
    setIsSearchOpen(true);
  };

  // Setup menu event listeners
  onMount(async () => {
    document.addEventListener('keydown', handleGlobalEsc);
    document.addEventListener('keydown', handleSearchShortcut);
    // Previous Day menu item
    unlisteners.push(await listen('menu-navigate-previous-day', () => goToPreviousDay()));

    // Next Day menu item
    unlisteners.push(await listen('menu-navigate-next-day', () => goToNextDay()));

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
    unlisteners.forEach((unlisten) => unlisten());
    document.removeEventListener('keydown', handleGlobalEsc);
    document.removeEventListener('keydown', handleSearchShortcut);
  });

  return (
    <div class="flex h-full overflow-hidden bg-secondary">
      {/* Backdrop that fades out on mount — creates the blur-dissolve unlock animation */}
      <div class="unlock-backdrop" aria-hidden="true" />

      {/* Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed()} onClose={() => setIsSidebarCollapsed(true)} />

      {/* Main content area */}
      <div class="flex flex-1 flex-col">
        {/* Header */}
        <Header showMenu onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed())} />

        {/* Main panel: editor or timeline list */}
        <main class="flex-1 overflow-hidden">
          <Show when={mainView() === 'timeline'} fallback={<EditorPanel />}>
            <Timeline />
          </Show>
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
      <NotificationsOverlay />
      <TagManager isOpen={isTagManagerOpen()} onClose={() => setIsTagManagerOpen(false)} />
      <OnboardingTour />
      <SearchOverlay />
    </div>
  );
}
