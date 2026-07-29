import { getRecentUiLogs, type UiLogRecord } from './logger';

/**
 * The browser-side half of the debug dump.
 *
 * Mirrors the Rust `ClientState` struct in `src-tauri/src/commands/debug.rs`, which
 * deserialises this envelope with `rename_all = "camelCase"` and `#[serde(default)]` on
 * every field — so a missing or unreadable key degrades to `null` rather than discarding
 * the payload.
 */
export interface ClientState {
  preferences: unknown;
  themePreference: unknown;
  themeOverrides: unknown;
  featureFlags: unknown;
  recentUiLogs: UiLogRecord[];
}

/**
 * Reads a localStorage key, parsing it as JSON when it looks like JSON.
 *
 * `theme-preference` is a bare string (`"dark"`), the other keys hold JSON objects, and a
 * corrupted value must not take the whole dump down with it — the dump exists precisely
 * for the sessions where something is already broken.
 */
function readKey(key: string): unknown {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Builds the client half of the debug dump: all four independent localStorage keys
 * (see `src/CLAUDE.md` gotcha #7) plus the recent UI log records.
 */
export function buildClientState(): ClientState {
  return {
    preferences: readKey('preferences'),
    themePreference: readKey('theme-preference'),
    themeOverrides: readKey('theme-overrides'),
    featureFlags: readKey('feature-flags'),
    recentUiLogs: getRecentUiLogs(),
  };
}
