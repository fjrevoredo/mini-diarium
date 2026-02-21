import { createSignal } from 'solid-js';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import * as tauri from '../lib/tauri';
import { setEntryDates } from './entries';
import { createLogger } from '../lib/logger';
import { mapTauriError } from '../lib/errors';

const log = createLogger('Auth');

export type AuthState = 'checking' | 'no-diary' | 'locked' | 'unlocked';

const [authState, setAuthState] = createSignal<AuthState>('checking');
const [error, setError] = createSignal<string | null>(null);
const [authMethods, setAuthMethods] = createSignal<tauri.AuthMethodInfo[]>([]);

interface DiaryLockedEventPayload {
  reason?: string;
}

// Initialize auth state on app load
export async function initializeAuth(): Promise<void> {
  try {
    const exists = await tauri.diaryExists();
    if (!exists) {
      setAuthState('no-diary');
      return;
    }

    const unlocked = await tauri.isDiaryUnlocked();
    setAuthState(unlocked ? 'unlocked' : 'locked');
  } catch (err) {
    log.error('Failed to initialize auth:', err);
    setError('Failed to check diary status');
    setAuthState('no-diary');
  }
}

// Create new diary
export async function createDiary(password: string): Promise<void> {
  try {
    setError(null);
    await tauri.createDiary(password);
    setAuthState('unlocked');
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
    setAuthState('unlocked');
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
    setAuthState('unlocked');
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
    setAuthState('locked');
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
      setAuthState('locked');
      setError(null);
      log.info(`Diary locked by backend event (${reason})`);
    },
  );

  return () => {
    unlistenDiaryLocked();
  };
}

export { authState, error, authMethods, setAuthMethods };
