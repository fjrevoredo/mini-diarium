import { createSignal } from 'solid-js';
import * as tauri from '../lib/tauri';
import { setEntryDates } from './entries';

export type AuthState = 'checking' | 'no-diary' | 'locked' | 'unlocked';

const [authState, setAuthState] = createSignal<AuthState>('checking');
const [error, setError] = createSignal<string | null>(null);

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
    console.error('Failed to initialize auth:', err);
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

    // Fetch entry dates after creating diary
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
    throw err;
  }
}

// Unlock existing diary
export async function unlockDiary(password: string): Promise<void> {
  try {
    setError(null);
    await tauri.unlockDiary(password);
    setAuthState('unlocked');

    // Fetch entry dates after unlocking diary
    const dates = await tauri.getAllEntryDates();
    setEntryDates(dates);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
    throw err;
  }
}

// Lock diary
export async function lockDiary(): Promise<void> {
  try {
    setError(null);
    await tauri.lockDiary();
    setAuthState('locked');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
    throw err;
  }
}

export { authState, error };
