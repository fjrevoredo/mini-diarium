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
  mainView,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isPreferencesOpen,
  setIsPreferencesOpen,
  isStatsOpen,
  setIsStatsOpen,
  isImportOpen,
  setIsImportOpen,
  isExportOpen,
  setIsExportOpen,
  isTagManagerOpen,
  setIsTagManagerOpen,
  isAnyOverlayOpen,
} from '../../state/ui';
import { preferences } from '../../state/preferences';
import { registerKeyboardShortcuts } from '../../lib/keyboard-shortcuts';
import { onboardingMode, minimizeOnboarding } from '../../state/onboarding';

const log = createLogger('MainLayout');

export default function MainLayout() {
  // Store cleanup functions at component level
  const unlisteners: UnlistenFn[] = [];
  let unregisterShortcuts: (() => void) | undefined;

  const handleGlobalEsc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (onboardingMode() === 'tour') {
      minimizeOnboarding();
      return;
    }
    if (onboardingMode() === 'minimized') return;
    // Never fire when any dialog is open — they handle their own Escape
    if (isAnyOverlayOpen()) return;
    if (preferences().escAction === 'quit') {
      getCurrentWindow()
        .close()
        .catch((err) => log.error('Failed to close window:', err));
    }
  };

  onMount(async () => {
    document.addEventListener('keydown', handleGlobalEsc);
    unregisterShortcuts = registerKeyboardShortcuts();

    // Preferences is the only remaining native menu item (TODO-0065) — every other
    // action moved into the webview, so this is the last `menu-*` listener.
    unlisteners.push(
      await listen('menu-preferences', () => {
        setIsPreferencesOpen(true);
      }),
    );
  });

  // Cleanup on component unmount
  onCleanup(() => {
    unlisteners.forEach((unlisten) => unlisten());
    document.removeEventListener('keydown', handleGlobalEsc);
    unregisterShortcuts?.();
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
