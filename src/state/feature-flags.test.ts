import { describe, it, expect, beforeEach, vi } from 'vitest';

// feature-flags.ts reads localStorage at module init via loadFlags(). Each test
// that exercises that path resets localStorage and reimports the module to force
// a fresh load. vi.resetModules() makes the dynamic import re-evaluate the body.

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('feature-flags', () => {
  it('defaults a flag to false when nothing is stored', async () => {
    const { isFeatureEnabled } = await import('./feature-flags');
    expect(isFeatureEnabled('inAppMenu')).toBe(false);
  });

  it('setFeatureFlag persists and reads back', async () => {
    const { isFeatureEnabled, setFeatureFlag } = await import('./feature-flags');

    setFeatureFlag('inAppMenu', true);
    expect(isFeatureEnabled('inAppMenu')).toBe(true);

    // Persisted to the dedicated 'feature-flags' key
    expect(JSON.parse(localStorage.getItem('feature-flags')!)).toEqual({ inAppMenu: true });
  });

  it('reads a stored true value on load', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({ inAppMenu: true }));
    const { isFeatureEnabled } = await import('./feature-flags');
    expect(isFeatureEnabled('inAppMenu')).toBe(true);
  });

  it('falls back to default (false) when the stored JSON is malformed', async () => {
    localStorage.setItem('feature-flags', '{not valid json');
    const { isFeatureEnabled } = await import('./feature-flags');
    expect(isFeatureEnabled('inAppMenu')).toBe(false);
  });

  it('ignores non-boolean values on load', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({ inAppMenu: 'yes' }));
    const { isFeatureEnabled } = await import('./feature-flags');
    // Non-boolean stored value is dropped; default false applies.
    expect(isFeatureEnabled('inAppMenu')).toBe(false);
  });

  it('drops non-boolean unknown/retired keys on load (no migration)', async () => {
    // A retired flag left behind as a non-boolean value must not survive load or
    // interfere with the recognized flags.
    localStorage.setItem(
      'feature-flags',
      JSON.stringify({ inAppMenu: true, retiredFlag: { some: 'object' } }),
    );
    const { isFeatureEnabled, setFeatureFlag } = await import('./feature-flags');

    expect(isFeatureEnabled('inAppMenu')).toBe(true);

    // Persisting re-serializes the cleaned in-memory map: the non-boolean stale
    // key is gone, no default was appended for any absent flag.
    setFeatureFlag('inAppMenu', false);
    const stored = JSON.parse(localStorage.getItem('feature-flags')!);
    expect(stored).toEqual({ inAppMenu: false });
  });
});
