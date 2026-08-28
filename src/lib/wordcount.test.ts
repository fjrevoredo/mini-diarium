import { describe, it, expect } from 'vitest';
import { countWordsInHtml, countWordsFromText } from './wordcount';

describe('countWordsInHtml', () => {
  it('counts words in plain text', () => {
    expect(countWordsInHtml('hello world')).toBe(2);
  });

  it('strips p tags and counts words', () => {
    expect(countWordsInHtml('<p>hello world</p>')).toBe(2);
  });

  it('handles multiple tags', () => {
    expect(countWordsInHtml('<p>one</p><p>two three</p>')).toBe(3);
  });

  it('normalises multiple whitespace', () => {
    expect(countWordsInHtml('<p>one   two</p>')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(countWordsInHtml('')).toBe(0);
  });

  it('returns 0 for empty paragraph', () => {
    expect(countWordsInHtml('<p></p>')).toBe(0);
  });

  it('returns 0 for base64 image tag', () => {
    const img =
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />';
    expect(countWordsInHtml(img)).toBe(0);
  });

  it('counts only text words when image is mixed with text', () => {
    const html = '<p>before</p><img src="data:image/png;base64,abc123==" /><p>after</p>';
    expect(countWordsInHtml(html)).toBe(2);
  });

  it('returns 0 for HTML tags only', () => {
    expect(countWordsInHtml('<p></p><div></div><br />')).toBe(0);
  });

  it('counts CJK characters inside tags, each as its own word', () => {
    expect(countWordsInHtml('<p>你好</p><p>world</p>')).toBe(3);
  });

  it('counts CJK adjacent to a base64 image tag', () => {
    const html = '<p>你好</p><img src="data:image/png;base64,abc123==" /><p>world</p>';
    expect(countWordsInHtml(html)).toBe(3);
  });
});

describe('countWordsFromText', () => {
  it('counts words in plain text', () => {
    expect(countWordsFromText('hello world')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(countWordsFromText('')).toBe(0);
  });

  it('handles leading/trailing whitespace', () => {
    expect(countWordsFromText('  hello world  ')).toBe(2);
  });

  it('normalises multiple spaces', () => {
    expect(countWordsFromText('one   two   three')).toBe(3);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWordsFromText('   \t\n  ')).toBe(0);
  });

  it('handles unicode text', () => {
    expect(countWordsFromText('café résumé')).toBe(2);
    expect(countWordsFromText('你好 世界')).toBe(4);
    expect(countWordsFromText('word\u{00A0}with\u{2003}unicode\u{3000}spaces')).toBe(4);
  });

  it('counts pure Chinese text with no spaces, one word per character', () => {
    expect(countWordsFromText('我今天很开心')).toBe(6);
  });

  it('counts mixed kanji/hiragana/katakana Japanese text with no spaces', () => {
    expect(countWordsFromText('私はコーヒーが好きです')).toBe(11);
  });

  it('counts CJK and Latin mixed across a space boundary', () => {
    expect(countWordsFromText('Hello 世界')).toBe(3);
  });

  it('does not split Korean text per-syllable (Hangul is excluded from the CJK rule)', () => {
    expect(countWordsFromText('안녕 하세요')).toBe(2);
  });
});
