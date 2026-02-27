import { createSignal } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import * as tauri from '../lib/tauri';
import { setEntryDates } from './entries';
import { createLogger } from '../lib/logger';
import { mapTauriError } from '../lib/errors';
import { loadJournals } from './journals';
import { resetSessionState } from './session';

const log = createLogger('Auth');

export type AuthState = 'checking' | 'journal-select' | 'no-diary' | 'locked' | 'unlocked';

const [authState, setAuthState] = createSignal<AuthState>('checking');
const [error, setError] = createSignal<string | null>(null);
const [authMethods, setAuthMethods] = createSignal<tauri.AuthMethodInfo[]>([]);

interface DiaryLockedEventPayload {
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

// Refresh auth state using the current backend diary path without reloading journal metadata.
export async function refreshAuthState(): Promise<void> {
  try {
    const exists = await tauri.diaryExists();
    if (!exists) {
      resetSessionState();
      resetAuthTransientState();
      setAuthState('no-diary');
      return;
    }

    const unlocked = await tauri.isDiaryUnlocked();
    if (unlocked) {
      setAuthState('unlocked');
    } else {
      resetForLockedSession();
    }
  } catch (err) {
    log.error('Failed to refresh auth state:', err);
    resetSessionState();
    setAuthMethods([]);
    setError('Failed to check diary status');
    setAuthState('journal-select');
  }
}

// Initialize auth + journals on app load — always lands on journal-select.
export async function initializeAuth(): Promise<void> {
  try {
    await loadJournals();
  } catch (err) {
    log.error('Failed to load journals:', err);
    setError('Failed to load journal list');
  }
  setAuthState('journal-select');
}

// Navigate back to the journal picker (e.g. from PasswordPrompt or PasswordCreation).
export function goToJournalPicker(): void {
  resetAuthTransientState();
  setAuthState('journal-select');
}

// Create new diary
export async function createDiary(password: string): Promise<void> {
  try {
    setError(null);
    await tauri.createDiary(password);
    prepareUnlockedSession();
    log.info('Diary created');

    // Fetch entry dates after creating diary
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Unlock existing diary with password
export async function unlockDiary(password: string): Promise<void> {
  try {
    setError(null);
    await tauri.unlockDiary(password);
    prepareUnlockedSession();
    log.info('Diary unlocked');

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
    await tauri.unlockDiaryWithKeypair(keyPath);
    prepareUnlockedSession();
    log.info('Diary unlocked with key file');

    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Lock diary
export async function lockDiary(): Promise<void> {
  try {
    setError(null);
    await tauri.lockDiary();
    resetForLockedSession();
    log.info('Diary locked');
  } catch (err) {
    const message = mapTauriError(err);
    setError(message);
    throw new Error(message, { cause: err });
  }
}

// Listen for backend-originated lock events (e.g. OS session lock).
export async function setupAuthEventListeners(): Promise<() => void> {
  const unlistenDiaryLocked: UnlistenFn = await listen<DiaryLockedEventPayload>(
    'diary-locked',
    (event) => {
      const reason = event.payload?.reason ?? 'unknown';
      resetForLockedSession();
      log.info(`Diary locked by backend event (${reason})`);
    },
  );

  return () => {
    unlistenDiaryLocked();
  };
}

export { authState, error, authMethods, setAuthMethods };
