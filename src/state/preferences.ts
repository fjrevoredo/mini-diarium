import { createSignal } from 'solid-js';
import { createLogger } from '../lib/logger';

const log = createLogger('Preferences');

export interface Preferences {
  allowFutureEntries: boolean;
  firstDayOfWeek: number | null; // 0-6 (Sunday-Saturday) or null for system default
  hideTitles: boolean;
  enableSpellcheck: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  allowFutureEntries: false, // Default: don't allow future entries
  firstDayOfWeek: null, // System default
  hideTitles: false,
  enableSpellcheck: true,
};

// Load preferences from localStorage
function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem('preferences');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (error) {
    log.warn('Failed to load preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

// Save preferences to localStorage
function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem('preferences', JSON.stringify(prefs));
  } catch (error) {
    log.warn('Failed to save preferences:', error);
  }
}

// Create preferences signal
const [preferences, setPreferencesSignal] = createSignal<Preferences>(loadPreferences());

// Helper to update preferences (auto-saves)
export function setPreferences(updates: Partial<Preferences>) {
  setPreferencesSignal((prev) => {
    const updated = { ...prev, ...updates };
    savePreferences(updated); // Save immediately when preferences change
    return updated;
  });
}

// Helper to reset to defaults (auto-saves)
export function resetPreferences() {
  savePreferences(DEFAULT_PREFERENCES);
  setPreferencesSignal(DEFAULT_PREFERENCES);
}

export { preferences };
