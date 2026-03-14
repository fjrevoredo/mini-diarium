import { afterEach, describe, expect, it } from 'vitest';
import {
  applyThemeOverrides,
  clearAppliedOverrides,
  getThemeOverridesJson,
  isValidTokenName,
  loadThemeOverrides,
  parseOverridesJson,
  resetThemeOverrides,
  saveThemeOverrides,
} from './theme-overrides';

afterEach(() => {
  clearAppliedOverrides();
  localStorage.clear();
});

describe('isValidTokenName', () => {
  it('accepts valid token prefixes', () => {
    expect(isValidTokenName('--bg-primary')).toBe(true);
    expect(isValidTokenName('--text-secondary')).toBe(true);
    expect(isValidTokenName('--editor-code-bg')).toBe(true);
    expect(isValidTokenName('--spinner-color')).toBe(true);
    expect(isValidTokenName('--overlay-bg')).toBe(true);
  });

  it('rejects invalid token names', () => {
    expect(isValidTokenName('--my-custom')).toBe(false);
    expect(isValidTokenName('color')).toBe(false);
    expect(isValidTokenName('')).toBe(false);
    expect(isValidTokenName('bg-primary')).toBe(false);
  });
});

describe('parseOverridesJson', () => {
  it('parses valid JSON with light/dark keys', () => {
    const result = parseOverridesJson('{"light":{"--bg-primary":"#fff"}}');
    expect(result).toEqual({ light: { '--bg-primary': '#fff' } });
  });

  it('returns null for invalid JSON syntax', () => {
    expect(parseOverridesJson('{bad json}')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseOverridesJson('"hello"')).toBeNull();
    expect(parseOverridesJson('42')).toBeNull();
  });

  it('silently drops disallowed keys', () => {
    const result = parseOverridesJson('{"light":{"--my-custom":"red","--bg-primary":"#fff"}}');
    expect(result).toEqual({ light: { '--bg-primary': '#fff' } });
  });

  it('returns empty object for empty object input', () => {
    expect(parseOverridesJson('{}')).toEqual({});
  });

  it('returns empty object for empty string input', () => {
    expect(parseOverridesJson('')).toEqual({});
  });
});

describe('loadThemeOverrides', () => {
  it('returns empty object when localStorage has no overrides', () => {
    expect(loadThemeOverrides()).toEqual({});
  });
});

describe('saveThemeOverrides / loadThemeOverrides', () => {
  it('round-trips overrides through localStorage', () => {
    const overrides = { light: { '--bg-primary': '#abc' } };
    saveThemeOverrides(overrides);
    expect(loadThemeOverrides()).toEqual(overrides);
  });
});

describe('resetThemeOverrides', () => {
  it('removes localStorage key and clears applied properties', () => {
    saveThemeOverrides({ light: { '--bg-primary': '#123' } });
    applyThemeOverrides('light');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('#123');
    resetThemeOverrides();
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('');
    expect(loadThemeOverrides()).toEqual({});
  });
});

describe('applyThemeOverrides', () => {
  it('injects properties for the resolved theme side', () => {
    saveThemeOverrides({ light: { '--bg-primary': '#123' } });
    applyThemeOverrides('light');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('#123');
  });

  it('removes previously applied properties when switching sides', () => {
    saveThemeOverrides({ light: { '--bg-primary': '#123' } });
    applyThemeOverrides('light');
    applyThemeOverrides('dark');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('');
  });
});

describe('getThemeOverridesJson', () => {
  it('returns "{}" when no overrides are stored', () => {
    expect(getThemeOverridesJson()).toBe('{}');
  });

  it('returns pretty-printed JSON when overrides exist', () => {
    saveThemeOverrides({ light: { '--bg-primary': '#abc' } });
    const json = getThemeOverridesJson();
    expect(JSON.parse(json)).toEqual({ light: { '--bg-primary': '#abc' } });
    expect(json).toContain('\n'); // pretty-printed
  });
});
