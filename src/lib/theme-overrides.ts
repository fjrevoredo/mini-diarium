export type ThemeOverrides = {
  light?: Record<string, string>;
  dark?: Record<string, string>;
};

const OVERRIDES_STORAGE_KEY = 'theme-overrides';
const ALLOWED_PREFIXES = [
  '--bg-',
  '--text-',
  '--border-',
  '--interactive-',
  '--btn-',
  '--editor-',
  '--status-',
  '--spinner-color',
  '--overlay-bg',
  '--shadow-',
];

// Module-level set of property names currently injected via style.setProperty
let _appliedKeys: Set<string> = new Set();

export function isValidTokenName(key: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function parseOverridesJson(json: string): ThemeOverrides | null {
  if (json.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const result: ThemeOverrides = {};
  const obj = parsed as Record<string, unknown>;
  for (const side of ['light', 'dark'] as const) {
    if (side in obj) {
      const raw = obj[side];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (isValidTokenName(k) && typeof v === 'string') {
          filtered[k] = v;
        }
      }
      result[side] = filtered;
    }
  }
  return result;
}

export function loadThemeOverrides(): ThemeOverrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = parseOverridesJson(raw);
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function saveThemeOverrides(overrides: ThemeOverrides): void {
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // swallow errors
  }
}

export function clearAppliedOverrides(): void {
  if (typeof document === 'undefined') return;
  for (const key of _appliedKeys) {
    document.documentElement.style.removeProperty(key);
  }
  _appliedKeys = new Set();
}

export function applyThemeOverrides(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  clearAppliedOverrides();
  const overrides = loadThemeOverrides();
  const side = overrides[resolved];
  if (!side) return;
  for (const [key, value] of Object.entries(side)) {
    document.documentElement.style.setProperty(key, value);
    _appliedKeys.add(key);
  }
}

export function resetThemeOverrides(): void {
  try {
    localStorage.removeItem(OVERRIDES_STORAGE_KEY);
  } catch {
    // swallow errors
  }
  clearAppliedOverrides();
}

export function getThemeOverridesJson(): string {
  const overrides = loadThemeOverrides();
  if (Object.keys(overrides).length === 0) return '{}';
  return JSON.stringify(overrides, null, 2);
}
