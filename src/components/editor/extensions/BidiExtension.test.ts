import { describe, it, expect } from 'vitest';
import { getFirstStrongDir } from './BidiExtension';

describe('getFirstStrongDir', () => {
  it('returns null for empty string', () => {
    expect(getFirstStrongDir('')).toBeNull();
  });

  it('returns null for punctuation-only text', () => {
    expect(getFirstStrongDir('123 !@# ')).toBeNull();
  });

  it('detects Latin A-Z as ltr', () => {
    expect(getFirstStrongDir('Hello')).toBe('ltr');
  });

  it('detects Latin a-z as ltr', () => {
    expect(getFirstStrongDir('hello world')).toBe('ltr');
  });

  it('detects Hebrew (U+05D0) as rtl', () => {
    expect(getFirstStrongDir('אבג')).toBe('rtl');
  });

  it('detects Arabic (U+0627) as rtl', () => {
    expect(getFirstStrongDir('العربية')).toBe('rtl');
  });

  it('uses first strong character — rtl before ltr wins', () => {
    expect(getFirstStrongDir('א Hello')).toBe('rtl');
  });

  it('uses first strong character — ltr before rtl wins', () => {
    expect(getFirstStrongDir('Hi א')).toBe('ltr');
  });
});
