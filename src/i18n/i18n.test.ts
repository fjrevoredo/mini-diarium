import { describe, it, expect } from 'vitest';
import { flatten } from '@solid-primitives/i18n';
import { mapTauriError } from '../lib/errors';
import en from './locales/en';
import { defaultT } from './index';

describe('i18n / locale', () => {
  const flat = flatten(en);

  it('flatten(en) produces all expected dot-notation keys', () => {
    expect(flat['common.save']).toBe('Save');
    expect(flat['auth.picker.empty']).toBeDefined();
    expect(flat['errors.incorrectPassword']).toBeDefined();
    expect(flat['prefs.writing.firstDayLabel']).toBeDefined();
    expect(flat['calendar.jan']).toBeDefined();
    expect(flat['editor.wordCount_one']).toBeDefined();
    expect(flat['stats.day_one']).toBeDefined();
  });

  it('all leaf (string) values in the flattened dict are non-empty', () => {
    // flatten() keeps both nested object keys AND flat dot-notation string keys;
    // only validate the leaf string values.
    const stringEntries = Object.entries(flat).filter(([, v]) => typeof v === 'string');
    expect(stringEntries.length).toBeGreaterThan(0);
    for (const [key, value] of stringEntries) {
      expect((value as string).length, `key "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it('interpolation: about.version renders the version number', () => {
    const result = defaultT('about.version', { version: '1.2.3' });
    expect(result).toBe('Version 1.2.3');
  });

  it('plural singular: editor.wordCount_one renders correctly', () => {
    const result = defaultT('editor.wordCount_one', { count: 1 });
    expect(result).toBe('1 word');
  });

  it('plural many: editor.wordCount_other renders correctly', () => {
    const result = defaultT('editor.wordCount_other', { count: 5 });
    expect(result).toBe('5 words');
  });

  it('plural singular: stats.day_one renders correctly', () => {
    const result = defaultT('stats.day_one', { count: 1 });
    expect(result).toBe('1 day');
  });

  it('plural many: stats.day_other renders correctly', () => {
    const result = defaultT('stats.day_other', { count: 42 });
    expect(result).toBe('42 days');
  });

  it('search.noResults interpolates the query', () => {
    const result = defaultT('search.noResults', { query: 'test' });
    expect(result).toBe('No results found for "test"');
  });

  it('auth.picker.renameAria interpolates the journal name', () => {
    const result = defaultT('auth.picker.renameAria', { name: 'My Journal' });
    expect(result).toBe('Rename My Journal');
  });

  it('all errors.* keys resolve to non-empty strings', () => {
    const errorKeys = Object.keys(flat).filter((k) => k.startsWith('errors.'));
    expect(errorKeys.length).toBeGreaterThan(0);
    for (const key of errorKeys) {
      const value = flat[key as keyof typeof flat] as string;
      expect(value.length, `${key} should not be empty`).toBeGreaterThan(0);
    }
  });
});

describe('mapTauriError', () => {
  it('maps wrong password → errors.incorrectPassword', () => {
    const result = mapTauriError('wrong password', defaultT);
    expect(result).toBe(en.errors.incorrectPassword);
  });

  it('maps decryption failure → errors.decryptionFailed', () => {
    const result = mapTauriError('decryption failed', defaultT);
    expect(result).toBe(en.errors.decryptionFailed);
  });

  it('maps journal not unlocked → errors.journalNotUnlocked', () => {
    const result = mapTauriError('journal must be unlocked', defaultT);
    expect(result).toBe(en.errors.journalNotUnlocked);
  });

  it('maps last auth removal → errors.cannotRemoveLastAuth', () => {
    const result = mapTauriError('cannot remove last auth method', defaultT);
    expect(result).toBe(en.errors.cannotRemoveLastAuth);
  });

  it('maps read key file error → errors.cannotReadKeyFile', () => {
    const result = mapTauriError('failed to read key file', defaultT);
    expect(result).toBe(en.errors.cannotReadKeyFile);
  });

  it('maps write key file error → errors.cannotSaveKeyFile', () => {
    const result = mapTauriError('failed to write key file', defaultT);
    expect(result).toBe(en.errors.cannotSaveKeyFile);
  });

  it('maps sqlite error → errors.internalError', () => {
    const result = mapTauriError('rusqlite: database is locked', defaultT);
    expect(result).toBe(en.errors.internalError);
  });

  it('passes through file-too-large errors verbatim', () => {
    const raw = 'File is too large to import (max 10 MB)';
    const result = mapTauriError(raw, defaultT);
    expect(result).toBe(raw);
  });

  it('passes through safe unknown messages verbatim', () => {
    const raw = 'Some benign user-facing message';
    const result = mapTauriError(raw, defaultT);
    expect(result).toBe(raw);
  });

  it('strips path-containing errors → errors.unexpectedError', () => {
    const result = mapTauriError('error at C:/Users/foo/diary.db', defaultT);
    expect(result).toBe(en.errors.unexpectedError);
  });
});
