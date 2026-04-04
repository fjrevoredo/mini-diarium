import { createSignal } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import * as tauri from '../lib/tauri';
import { setEntryDates, executeCleanupCallbacks } from './entries';
import { createLogger } from '../lib/logger';
import { mapTauriError } from '../lib/errors';
import { journals, activeJournalId, loadJournals } from './journals';
import { resetSessionState } from './session';

const log = createLogger('Auth');

export type AuthState = 'checking' | 'journal-select' | 'no-journal' | 'locked' | 'unlocked';

const [authState, setAuthState] = createSignal<AuthState>('checking');
const [error, setError] = createSignal<string | null>(null);
const [authMethods, setAuthMethods] = createSignal<tauri.AuthMethodInfo[]>([]);

interface JournalLockedEventPayload {
  reason?: string;
}

export function resetAuthTransientState(): void {
  setError(null);
  setAuthMethods([]);
}

function resetForLockedSession(): void {
  resetSessionState();
  resetAuthTransientState();
  setAuthState('locked');
}

function prepareUnlockedSession(): void {
  resetSessionState();
  resetAuthTransientState();
  setAuthState('unlocked');
}

// Refresh auth state using the current backend journal path without reloading journal metadata.
export async function refreshAuthState(): Promise<void> {
  try {
    const exists = await tauri.journalExists();
    if (!exists) {
      resetSessionState();
      resetAuthTransientState();
      setAuthState('no-journal');
      return;
    }

    const unlocked = await tauri.isJournalUnlocked();
    if (unlocked) {
      setAuthState('unlocked');
    } else {
      resetForLockedSession();
    }
  } catch (err) {
    log.error('Failed to refresh auth state:', err);
    resetSessionState();
    setAuthMethods([]);
    setError('Failed to check journal status');
    setAuthState('journal-select');
  }
}

// Initialize auth + journals on app load — auto-selects last journal if available.
export async function initializeAuth(): Promise<void> {
  try {
    await loadJournals();
  } catch (err) {
    log.error('Failed to load journals:', err);
    setError('Failed to load journal list');
  }

  if (activeJournalId() !== null) {
    const activeJournal = journals().find((j) => j.id === activeJournalId());
    if (activeJournal?.auto_protected) {
      // Attempt silent auto-unlock; fall back to lock screen on failure
      try {
        const exists = await tauri.journalExists();
        if (!exists) {
          setAuthState('no-journal');
          return;
        }
        await tauri.unlockJournalAuto();
        prepareUnlockedSession();
        const dates = await tauri.getAllEntryDates();
        setEntryDates(dates);
      } catch (err) {
        log.warn('Auto-unlock failed, falling back to lock screen:', err);
        resetForLockedSession();
      }
    } else {
      await refreshAuthState();
    }
  } else {
    setAuthState('journal-select');
  }
}

export async function createJournalAutoProtected(): Promise<void> {
  try {
    setError(null);
    await tauri.createJournalAuto();
    // Reload journals so auto_protected = true is reflected in the signal.
    // Without this, locking the journal in the same session would show the
    // password form instead of auto-unlocking (journals() would be stale).
    await loadJournals();
    prepareUnlockedSession();
    log.info('Local-only journal created');
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

export async function unlockJournalAutoProtected(): Promise<void> {
  try {
    setError(null);
    await tauri.unlockJournalAuto();
    prepareUnlockedSession();
    log.info('Local-only journal auto-unlocked');
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Navigate back to the journal picker (e.g. from PasswordPrompt or PasswordCreation).
export function goToJournalPicker(): void {
  resetAuthTransientState();
  setAuthState('journal-select');
}

// Create new journal
export async function createJournal(password: string): Promise<void> {
  try {
    setError(null);
    await tauri.createJournal(password);
    prepareUnlockedSession();
    log.info('Journal created');

    // Fetch entry dates after creating diary
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Unlock existing journal with password
export async function unlockJournal(password: string): Promise<void> {
  try {
    setError(null);
    await tauri.unlockJournal(password);
    prepareUnlockedSession();
    log.info('Journal unlocked');

    // Fetch entry dates after unlocking diary
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Unlock existing diary with keypair key file
export async function unlockWithKeypair(keyPath: string): Promise<void> {
  try {
    setError(null);
    await tauri.unlockJournalWithKeypair(keyPath);
    prepareUnlockedSession();
    log.info('Journal unlocked with key file');

    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Lock journal
export async function lockJournal(): Promise<void> {
  try {
    setError(null);
    await executeCleanupCallbacks();
    await tauri.lockJournal();
    resetForLockedSession();
    log.info('Journal locked');
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Listen for backend-originated lock events (e.g. OS session lock).
export async function setupAuthEventListeners(): Promise<() => void> {
  const unlistenJournalLocking: UnlistenFn = await listen<string>(
    'journal-locking',
    async (event) => {
      const reason = event.payload ?? 'unknown';
      log.info(`Journal locking by backend (${reason})`);
      await executeCleanupCallbacks();
    },
  );

  const unlistenJournalLocked: UnlistenFn = await listen<JournalLockedEventPayload>(
    'journal-locked',
    (event) => {
      const reason = event.payload?.reason ?? 'unknown';
      resetForLockedSession();
      log.info(`Journal locked by backend (${reason})`);
    },
  );

  return () => {
    unlistenJournalLocking();
    unlistenJournalLocked();
  };
}

export { authState, error, authMethods, setAuthMethods };
