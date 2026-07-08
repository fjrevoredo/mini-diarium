import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setTheme,
  getThemePreference,
  getActiveTheme,
  initializeTheme,
  themePreference,
} from './theme';

type ChangeHandler = () => void;

/**
 * Installs a controllable matchMedia mock (setup.ts installs one returning
 * `matches: false`; theme.ts reads it and subscribes to its `change` event).
 * Returns a `fireChange` helper to simulate the OS flipping its color scheme.
 */
function installMatchMedia(prefersDark: boolean) {
  const handlers: ChangeHandler[] = [];
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, h: ChangeHandler) => handlers.push(h),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    fireChange: (dark: boolean) => {
      mql.matches = dark;
      handlers.forEach((h) => h());
    },
  };
}

const html = () => document.documentElement;

describe('lib/theme', () => {
  beforeEach(() => {
    localStorage.clear();
    html().className = '';
    html().removeAttribute('data-theme');
    installMatchMedia(false);
    setTheme('light'); // deterministic baseline
    localStorage.clear();
  });

  it('setTheme("dark") applies the dark class + data-theme and persists the preference', () => {
    setTheme('dark');

    expect(getThemePreference()).toBe('dark');
    expect(themePreference()).toBe('dark');
    expect(getActiveTheme()).toBe('dark');
    expect(html().classList.contains('dark')).toBe(true);
    expect(html().getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme-preference')).toBe('dark');
  });

  it('setTheme("light") removes the dark class and persists the preference', () => {
    setTheme('dark');
    setTheme('light');

    expect(getActiveTheme()).toBe('light');
    expect(html().classList.contains('dark')).toBe(false);
    expect(html().getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme-preference')).toBe('light');
  });

  it('setTheme("auto") resolves the active theme from the OS (dark)', () => {
    installMatchMedia(true);
    setTheme('auto');

    expect(getThemePreference()).toBe('auto');
    expect(getActiveTheme()).toBe('dark');
    expect(html().getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme("auto") resolves the active theme from the OS (light)', () => {
    installMatchMedia(false);
    setTheme('auto');

    expect(getActiveTheme()).toBe('light');
    expect(html().getAttribute('data-theme')).toBe('light');
  });

  it('initializeTheme follows OS changes while in auto mode', () => {
    const mm = installMatchMedia(false);
    setTheme('auto');
    initializeTheme();
    expect(getActiveTheme()).toBe('light');

    mm.fireChange(true);

    expect(getActiveTheme()).toBe('dark');
    expect(html().classList.contains('dark')).toBe(true);
  });

  it('initializeTheme ignores OS changes when a fixed theme is selected', () => {
    const mm = installMatchMedia(false);
    initializeTheme();
    setTheme('light');

    mm.fireChange(true); // OS goes dark, but the user pinned light

    expect(getActiveTheme()).toBe('light');
    expect(html().classList.contains('dark')).toBe(false);
  });
});
