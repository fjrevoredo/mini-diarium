import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FeatureFlag } from './feature-flags';

// feature-flags.ts reads localStorage at module init via loadFlags(). Each test
// that exercises that path resets localStorage and reimports the module to force
// a fresh load. vi.resetModules() makes the dynamic import re-evaluate the body.

// The `FeatureFlag` union is currently empty — `inAppMenu` graduated in TODO-0065 and
// no flag has replaced it yet. The store itself is an open `Record<string, boolean>`,
// so its load/persist/unknown-key behavior is still exercised here through a synthetic
// key. The cast is what a real flag's literal type would be once one is declared, so
// these tests keep guarding the module until then.
const TEST_FLAG = 'testFlag' as unknown as FeatureFlag;

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('feature-flags', () => {
  it('registers no flags today, so the Experimental preferences section stays hidden', async () => {
    // The `PreferencesAdvancedTab` section renders from this registry and hides while
    // it is empty. Pinning that here is what makes the component's "hidden" test a
    // statement about production rather than about its own mock.
    const { FEATURE_FLAGS } = await import('./feature-flags');
    expect(FEATURE_FLAGS).toHaveLength(0);
  });

  it('defaults a flag to false when nothing is stored', async () => {
    const { isFeatureEnabled } = await import('./feature-flags');
    expect(isFeatureEnabled(TEST_FLAG)).toBe(false);
  });

  it('setFeatureFlag persists and reads back', async () => {
    const { isFeatureEnabled, setFeatureFlag } = await import('./feature-flags');

    setFeatureFlag(TEST_FLAG, true);
    expect(isFeatureEnabled(TEST_FLAG)).toBe(true);

    // Persisted to the dedicated 'feature-flags' key
    expect(JSON.parse(localStorage.getItem('feature-flags')!)).toEqual({ testFlag: true });
  });

  it('reads a stored true value on load', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({ testFlag: true }));
    const { isFeatureEnabled } = await import('./feature-flags');
    expect(isFeatureEnabled(TEST_FLAG)).toBe(true);
  });

  it('falls back to default (false) when the stored JSON is malformed', async () => {
    localStorage.setItem('feature-flags', '{not valid json');
    const { isFeatureEnabled } = await import('./feature-flags');
    expect(isFeatureEnabled(TEST_FLAG)).toBe(false);
  });

  it('ignores non-boolean values on load', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({ testFlag: 'yes' }));
    const { isFeatureEnabled } = await import('./feature-flags');
    // Non-boolean stored value is dropped; default false applies.
    expect(isFeatureEnabled(TEST_FLAG)).toBe(false);
  });

  it('drops non-boolean unknown/retired keys on load (no migration)', async () => {
    // A retired flag left behind as a non-boolean value must not survive load or
    // interfere with the recognized flags.
    localStorage.setItem(
      'feature-flags',
      JSON.stringify({ testFlag: true, retiredFlag: { some: 'object' } }),
    );
    const { isFeatureEnabled, setFeatureFlag } = await import('./feature-flags');

    expect(isFeatureEnabled(TEST_FLAG)).toBe(true);

    // Persisting re-serializes the cleaned in-memory map: the non-boolean stale
    // key is gone, no default was appended for any absent flag.
    setFeatureFlag(TEST_FLAG, false);
    const stored = JSON.parse(localStorage.getItem('feature-flags')!);
    expect(stored).toEqual({ testFlag: false });
  });

  it('keeps a boolean-valued retired key on load until it is overwritten', async () => {
    // Retiring a flag is deleting it from the union + DEFAULTS — no migration runs,
    // so a stale boolean simply rides along harmlessly in the open record.
    localStorage.setItem('feature-flags', JSON.stringify({ inAppMenu: true }));
    const { setFeatureFlag } = await import('./feature-flags');

    setFeatureFlag(TEST_FLAG, true);

    expect(JSON.parse(localStorage.getItem('feature-flags')!)).toEqual({
      inAppMenu: true,
      testFlag: true,
    });
  });
});
