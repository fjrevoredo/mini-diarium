import { createSignal } from 'solid-js';
import { createLogger } from '../lib/logger';

const log = createLogger('FeatureFlags');

/**
 * Runtime feature flags (Tier 2 of the feature-flag strategy — see
 * docs/decisions/2026-06-feature-flags.md). Unlike the build-time
 * `VITE_EXPERIMENTAL` gate, these flip at runtime without a rebuild, via the
 * Advanced preferences tab.
 *
 * The store is intentionally **migration-free**: it is an open
 * `Record<string, boolean>` in its own localStorage key. Adding a flag = extend
 * the `FeatureFlag` union and `DEFAULTS`. Retiring one = delete from both; any
 * stale stored key is silently dropped on the next load. There is never a
 * migration block to maintain (contrast `preferences.ts`).
 */
export type FeatureFlag = 'inAppMenu';

const DEFAULTS: Record<FeatureFlag, boolean> = {
  inAppMenu: false,
};

const STORAGE_KEY = 'feature-flags';

// Load flags from localStorage, keeping only boolean-valued entries. Unknown or
// retired keys are ignored harmlessly (no migration, no default-appending).
function loadFlags(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const flags: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean') {
          flags[key] = value;
        }
      }
      return flags;
    }
  } catch (error) {
    log.warn('Failed to load feature flags:', error);
  }
  return {};
}

function saveFlags(flags: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch (error) {
    log.warn('Failed to save feature flags:', error);
  }
}

const [flags, setFlags] = createSignal<Record<string, boolean>>(loadFlags());

/** Reactive read — a missing key falls back to its default (typically `false`). */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return flags()[flag] ?? DEFAULTS[flag];
}

/** Set a flag and persist it. */
export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  setFlags((prev) => {
    const updated = { ...prev, [flag]: enabled };
    saveFlags(updated);
    return updated;
  });
}
