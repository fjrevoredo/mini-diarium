import { createSignal } from 'solid-js';
import { createLogger } from '../lib/logger';
import type { T } from '../i18n';

const log = createLogger('FeatureFlags');

/**
 * Runtime feature flags (Tier 2 of the feature-flag strategy — see
 * docs/decisions/2026-06-feature-flags.md). Unlike the build-time
 * `VITE_EXPERIMENTAL` gate, these flip at runtime without a rebuild, via the
 * Advanced preferences tab.
 *
 * The store is intentionally **migration-free**: it is an open
 * `Record<string, boolean>` in its own localStorage key. Adding a flag = extend
 * the `FeatureFlag` union, `DEFAULTS`, and the `FEATURE_FLAGS` registry below.
 * Retiring one = delete from all three; any stale stored key is silently dropped
 * on the next load. There is never a migration block to maintain (contrast
 * `preferences.ts`).
 *
 * **The union is intentionally empty right now.** `inAppMenu` — the only flag this
 * module ever carried — graduated on 2026-07-25 (TODO-0065) and was deleted per the
 * rule above. The module stays as dormant infrastructure so the next in-progress
 * feature that needs a runtime toggle costs three small edits (`FeatureFlag`,
 * `DEFAULTS`, `FEATURE_FLAGS`) rather than a rebuild. The Preferences → Advanced
 * "Experimental Features" section renders from `FEATURE_FLAGS` and hides itself
 * while that list is empty, so no empty group is shown in the meantime.
 */
export type FeatureFlag = never;

const DEFAULTS: Record<FeatureFlag, boolean> = {};

/** A flag plus the i18n key of the label its toggle renders with. */
export interface FeatureFlagDef {
  flag: FeatureFlag;
  labelKey: Parameters<T>[0];
}

/**
 * The flags Preferences → Advanced → Experimental Features renders a toggle for,
 * in display order. Adding a flag means adding it to `FeatureFlag`, `DEFAULTS`, and
 * here (the compiler enforces a label key); the section renders itself from this
 * list and **hides entirely while the list is empty**, which is the state today.
 */
export const FEATURE_FLAGS: readonly FeatureFlagDef[] = [];

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

/**
 * Reactive read — a missing key falls back to its default. The trailing `?? false`
 * covers a flag absent from `DEFAULTS` (including every key while the union is empty):
 * flags are off until something explicitly turns them on.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return flags()[flag] ?? DEFAULTS[flag] ?? false;
}

/** Set a flag and persist it. */
export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  setFlags((prev) => {
    const updated = { ...prev, [flag]: enabled };
    saveFlags(updated);
    return updated;
  });
}
