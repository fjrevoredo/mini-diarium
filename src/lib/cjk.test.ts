import { describe, it, expect } from 'vitest';
import { isCjkCodePoint, containsCjk } from './cjk';

describe('isCjkCodePoint', () => {
  it('detects Han', () => {
    expect(isCjkCodePoint('你'.codePointAt(0)!)).toBe(true);
  });

  it('detects Hiragana', () => {
    expect(isCjkCodePoint('あ'.codePointAt(0)!)).toBe(true);
  });

  it('detects Katakana', () => {
    expect(isCjkCodePoint('ア'.codePointAt(0)!)).toBe(true);
  });

  it('rejects Latin', () => {
    expect(isCjkCodePoint('a'.codePointAt(0)!)).toBe(false);
  });

  it('rejects Hangul (Korean is excluded by design)', () => {
    expect(isCjkCodePoint('가'.codePointAt(0)!)).toBe(false);
  });

  it('respects Han range boundaries', () => {
    expect(isCjkCodePoint(0x4e00)).toBe(true);
    expect(isCjkCodePoint(0x9fff)).toBe(true);
    expect(isCjkCodePoint(0x4dff)).toBe(false);
    expect(isCjkCodePoint(0xa000)).toBe(false);
  });

  it('respects Katakana range boundaries', () => {
    expect(isCjkCodePoint(0x30a0)).toBe(true);
    expect(isCjkCodePoint(0x30ff)).toBe(true);
    expect(isCjkCodePoint(0x309f)).toBe(true);
    expect(isCjkCodePoint(0x3100)).toBe(false);
  });
});

describe('containsCjk', () => {
  it('returns false for empty string', () => {
    expect(containsCjk('')).toBe(false);
  });

  it('returns false for pure Latin text', () => {
    expect(containsCjk('hello world')).toBe(false);
  });

  it('returns true for pure Han text', () => {
    expect(containsCjk('你好')).toBe(true);
  });

  it('returns true for pure Hiragana text', () => {
    expect(containsCjk('ひらがな')).toBe(true);
  });

  it('returns true for pure Katakana text', () => {
    expect(containsCjk('カタカナ')).toBe(true);
  });

  it('returns true for mixed Latin and CJK text', () => {
    expect(containsCjk('Hello 世界')).toBe(true);
  });

  it('returns false for Korean-only text (control case)', () => {
    expect(containsCjk('안녕하세요')).toBe(false);
  });
});
