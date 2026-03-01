import { Match, Switch, createEffect, onCleanup, onMount } from 'solid-js';
import { authState, initializeAuth, lockDiary, setupAuthEventListeners } from './state/auth';
import { initializeTheme } from './lib/theme';
import { createLogger } from './lib/logger';
import { preferences } from './state/preferences';
import JournalPicker from './components/auth/JournalPicker';
import PasswordCreation from './components/auth/PasswordCreation';
import PasswordPrompt from './components/auth/PasswordPrompt';
import MainLayout from './components/layout/MainLayout';

const log = createLogger('App');

function App() {
  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  createEffect(() => {
    const { autoLockEnabled, autoLockTimeout } = preferences();
    const state = authState();

    if (!autoLockEnabled || state !== 'unlocked') return;

    function handleActivity() {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => void lockDiary(), autoLockTimeout * 1000);
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

    onCleanup(() => {
      cleanupAuthListeners?.();
    });
  });

  return (
    <Switch>
      <Match when={authState() === 'checking'}>
        <div class="flex min-h-screen items-center justify-center bg-gray-50">
          <div class="text-center">
            <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
            <p class="text-gray-600">Loading...</p>
          </div>
        </div>
      </Match>

      <Match when={authState() === 'journal-select'}>
        <JournalPicker />
      </Match>

      <Match when={authState() === 'no-diary'}>
        <PasswordCreation />
      </Match>

      <Match when={authState() === 'locked'}>
        <PasswordPrompt />
      </Match>

      <Match when={authState() === 'unlocked'}>
        <MainLayout />
      </Match>
    </Switch>
  );
}

export default App;
