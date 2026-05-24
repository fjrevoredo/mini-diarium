import { createSignal } from 'solid-js';
import { createLogger } from '../lib/logger';

const log = createLogger('Preferences');

export type EscAction = 'none' | 'quit';

export type ToolbarItemKey =
  | 'underline'
  | 'strikethrough'
  | 'textColor'
  | 'highlightColor'
  | 'headings'
  | 'blockquote'
  | 'inlineCode'
  | 'bulletList'
  | 'orderedList'
  | 'horizontalRule'
  | 'insertImage'
  | 'importMarkdown'
  | 'insertTimestamp'
  | 'textDirection'
  | 'alignment'
  | 'fontFamily'
  | 'fontSize';

export interface ToolbarItem {
  key: ToolbarItemKey;
  enabled: boolean;
}

export const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[] = [
  { key: 'headings', enabled: true },
  { key: 'underline', enabled: true },
  { key: 'strikethrough', enabled: true },
  { key: 'textColor', enabled: true },
  { key: 'highlightColor', enabled: true },
  { key: 'blockquote', enabled: true },
  { key: 'inlineCode', enabled: true },
  { key: 'bulletList', enabled: true },
  { key: 'orderedList', enabled: true },
  { key: 'horizontalRule', enabled: true },
  { key: 'insertImage', enabled: true },
  { key: 'importMarkdown', enabled: true },
  { key: 'insertTimestamp', enabled: true },
  { key: 'textDirection', enabled: true },
  { key: 'alignment', enabled: true },
  { key: 'fontFamily', enabled: false },
  { key: 'fontSize', enabled: false },
];

export interface Preferences {
  allowFutureEntries: boolean;
  firstDayOfWeek: number | null; // 0-6 (Sunday-Saturday) or null for system default
  hideTitles: boolean;
  enableSpellcheck: boolean;
  escAction: EscAction;
  autoLockEnabled: boolean;
  autoLockTimeout: number; // seconds, 1–999
  toolbarItems: ToolbarItem[];
  editorFontSize: number; // px, 12–24
  editorFontFamily: string | null; // null means system default
  showEntryTimestamps: boolean;
  timestampFormat: '12h' | '24h';
  timestampPrecision: 'hm' | 'hms';
  language: string; // locale code, e.g. 'en'
}

const DEFAULT_PREFERENCES: Preferences = {
  allowFutureEntries: false,
  firstDayOfWeek: null,
  hideTitles: false,
  enableSpellcheck: true,
  escAction: 'none',
  autoLockEnabled: false,
  autoLockTimeout: 300,
  toolbarItems: DEFAULT_TOOLBAR_ITEMS,
  editorFontSize: 16,
  editorFontFamily: null,
  showEntryTimestamps: false,
  timestampFormat: '12h',
  timestampPrecision: 'hm',
  language: 'en',
};

// Items that were always visible before the per-item toolbar config was introduced
const WAS_ALWAYS_VISIBLE: ToolbarItemKey[] = ['underline', 'bulletList', 'orderedList'];

// Load preferences from localStorage
function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem('preferences');
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;

      // Migrate from advancedToolbar boolean to per-item toolbarItems array
      if ('advancedToolbar' in parsed && !('toolbarItems' in parsed)) {
        const allEnabled = parsed.advancedToolbar === true;
        parsed.toolbarItems = DEFAULT_TOOLBAR_ITEMS.map((item) => ({
          ...item,
          enabled: allEnabled || WAS_ALWAYS_VISIBLE.includes(item.key),
        }));
        delete parsed.advancedToolbar;
      }

      // Append any new default toolbar keys not yet in stored list
      if (Array.isArray(parsed.toolbarItems)) {
        const existingKeys = new Set((parsed.toolbarItems as ToolbarItem[]).map((i) => i.key));
        const missing = DEFAULT_TOOLBAR_ITEMS.filter((i) => !existingKeys.has(i.key));
        if (missing.length > 0) {
          parsed.toolbarItems = [...(parsed.toolbarItems as ToolbarItem[]), ...missing];
        }
      }

      return { ...DEFAULT_PREFERENCES, ...(parsed as Partial<Preferences>) };
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
