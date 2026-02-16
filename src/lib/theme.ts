import { createSignal } from 'solid-js';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme-preference';
const DEFAULT_THEME: ThemePreference = 'auto';

// Signal for theme preference ('auto', 'light', or 'dark')
const [themePreference, setThemePreference] = createSignal<ThemePreference>(
  loadThemePreference()
);

// Signal for resolved/active theme ('light' or 'dark')
const [activeTheme, setActiveTheme] = createSignal<ResolvedTheme>('light');

/**
 * Load theme preference from localStorage
 */
function loadThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'auto' || stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (e) {
    console.warn('Failed to load theme preference:', e);
  }
  return DEFAULT_THEME;
}

/**
 * Save theme preference to localStorage
 */
function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch (e) {
    console.warn('Failed to save theme preference:', e);
  }
}

/**
 * Get OS theme using matchMedia
 */
function getOsTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';

  // Check if dark mode is preferred
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/**
 * Resolve the active theme based on preference and OS theme
 */
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'auto') {
    return getOsTheme();
  }
  return preference;
}

/**
 * Apply theme to document by setting CSS class
 */
function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;

  // UnoCSS dark mode uses 'dark' class on html element
  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // Also set data attribute for easier CSS targeting
  html.setAttribute('data-theme', theme);
}

/**
 * Initialize theme system
 * Sets up OS theme change listener and applies initial theme
 */
export function initializeTheme(): void {
  // Set initial theme
  const initial = resolveTheme(themePreference());
  setActiveTheme(initial);
  applyTheme(initial);

  // Listen to OS theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      // Only update if in auto mode
      if (themePreference() === 'auto') {
        const newTheme = resolveTheme('auto');
        setActiveTheme(newTheme);
        applyTheme(newTheme);
      }
    };

    // Modern API
    mediaQuery.addEventListener('change', handleChange);

    // Note: In a real app, we'd need to clean this up when the app unmounts
    // For now, this listener will persist for the app's lifetime
  }
}

/**
 * Set theme preference
 * @param preference - 'auto', 'light', or 'dark'
 */
export function setTheme(preference: ThemePreference): void {
  setThemePreference(preference);
  saveThemePreference(preference);

  const resolved = resolveTheme(preference);
  setActiveTheme(resolved);
  applyTheme(resolved);
}

/**
 * Get current theme preference
 */
export function getThemePreference(): ThemePreference {
  return themePreference();
}

/**
 * Get current active/resolved theme
 */
export function getActiveTheme(): ResolvedTheme {
  return activeTheme();
}

// Export signals for reactive components
export { themePreference, activeTheme };
