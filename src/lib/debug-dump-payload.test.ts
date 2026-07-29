import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildClientState } from './debug-dump-payload';
import { createLogger, clearRecentUiLogs } from './logger';

describe('buildClientState', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRecentUiLogs();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearRecentUiLogs();
  });

  it('reads all four independent localStorage keys', () => {
    localStorage.setItem('preferences', JSON.stringify({ language: 'de' }));
    localStorage.setItem('theme-preference', JSON.stringify('dark'));
    localStorage.setItem('theme-overrides', JSON.stringify({ '--bg': '#000' }));
    localStorage.setItem('feature-flags', JSON.stringify({ someFlag: true }));

    const state = buildClientState();
    expect(state.preferences).toEqual({ language: 'de' });
    expect(state.themePreference).toBe('dark');
    expect(state.themeOverrides).toEqual({ '--bg': '#000' });
    expect(state.featureFlags).toEqual({ someFlag: true });
  });

  it('reports missing keys as null rather than throwing', () => {
    const state = buildClientState();
    expect(state.preferences).toBeNull();
    expect(state.themePreference).toBeNull();
    expect(state.themeOverrides).toBeNull();
    expect(state.featureFlags).toBeNull();
    expect(state.recentUiLogs).toEqual([]);
  });

  it('passes a corrupted value through as a raw string', () => {
    // The dump exists for sessions where something is already broken; unparseable
    // storage is a diagnostic signal, not a reason to fail.
    localStorage.setItem('preferences', '{not json');
    expect(buildClientState().preferences).toBe('{not json');
  });

  it('keeps a bare (unquoted) theme value readable', () => {
    localStorage.setItem('theme-preference', 'dark');
    expect(buildClientState().themePreference).toBe('dark');
  });

  it('includes the recent UI log records', () => {
    createLogger('editor').info('saved entry');

    const logs = buildClientState().recentUiLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ level: 'info', module: 'editor', message: 'saved entry' });
  });

  it('produces the exact envelope shape the Rust ClientState deserialises', () => {
    expect(Object.keys(buildClientState()).sort()).toEqual([
      'featureFlags',
      'preferences',
      'recentUiLogs',
      'themeOverrides',
      'themePreference',
    ]);
  });
});
