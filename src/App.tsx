import { Match, Switch, createEffect, onCleanup, onMount } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { authState, initializeAuth, lockJournal, setupAuthEventListeners } from './state/auth';
import { initializeTheme } from './lib/theme';
import { createLogger } from './lib/logger';
import { preferences } from './state/preferences';
import { setLocale, useI18n } from './i18n';
import { isAboutOpen, setIsAboutOpen } from './state/ui';
import JournalPicker from './components/auth/JournalPicker';
import PasswordCreation from './components/auth/PasswordCreation';
import PasswordPrompt from './components/auth/PasswordPrompt';
import MainLayout from './components/layout/MainLayout';
import AboutOverlay from './components/overlays/AboutOverlay';

const log = createLogger('App');

function App() {
  const t = useI18n();
  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  // Sync locale signal from persisted preference — runs immediately on mount
  // and re-runs whenever preferences().language changes.
  createEffect(() => {
    setLocale(preferences().language);
  });

  createEffect(() => {
    const { autoLockEnabled, autoLockTimeout } = preferences();
    const state = authState();

    if (!autoLockEnabled || state !== 'unlocked') return;

    function handleActivity() {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => void lockJournal(), autoLockTimeout * 1000);
    }

    handleActivity(); // start initial timer
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, handleActivity, { passive: true }));

    onCleanup(() => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, handleActivity));
    });
  });

  onMount(() => {
    initializeAuth();
    initializeTheme();

    let cleanupAuthListeners: (() => void) | undefined;
    void setupAuthEventListeners()
      .then((cleanup) => {
        cleanupAuthListeners = cleanup;
      })
      .catch((error) => {
        // Listener setup failure should not block app startup.
        log.error('Failed to setup auth event listeners:', error);
      });

    let unlistenAbout: UnlistenFn | undefined;
    void listen('menu-about', () => setIsAboutOpen(true)).then((fn) => {
      unlistenAbout = fn;
    });

    onCleanup(() => {
      cleanupAuthListeners?.();
      unlistenAbout?.();
    });
  });

  return (
    <>
      <Switch>
        <Match when={authState() === 'checking'}>
          <div class="flex h-full items-center justify-center bg-secondary">
            <div class="text-center">
              <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 spinner-border border-t-transparent mx-auto" />
              <p class="text-secondary">{t('layout.loading')}</p>
            </div>
          </div>
        </Match>

        <Match when={authState() === 'journal-select'}>
          <JournalPicker />
        </Match>

        <Match when={authState() === 'no-journal'}>
          <PasswordCreation />
        </Match>

        <Match when={authState() === 'locked'}>
          <PasswordPrompt />
        </Match>

        <Match when={authState() === 'unlocked'}>
          <MainLayout />
        </Match>
      </Switch>
      <AboutOverlay isOpen={isAboutOpen()} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}

export default App;
