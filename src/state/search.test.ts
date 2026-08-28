import { describe, it, expect } from 'vitest';
import { meetsMinQueryLength } from './search';

describe('meetsMinQueryLength', () => {
  it('rejects a 2-character non-CJK query', () => {
    expect(meetsMinQueryLength('ab')).toBe(false);
  });

  it('accepts a 3-character non-CJK query', () => {
    expect(meetsMinQueryLength('abc')).toBe(true);
  });

  it('accepts a 1-character CJK query', () => {
    expect(meetsMinQueryLength('你')).toBe(true);
  });

  it('rejects a 1-character non-CJK query', () => {
    expect(meetsMinQueryLength('a')).toBe(false);
  });

  it('trims whitespace before checking length', () => {
    expect(meetsMinQueryLength('  你 ')).toBe(true);
  });

  it('rejects an empty query', () => {
    expect(meetsMinQueryLength('')).toBe(false);
  });
});
