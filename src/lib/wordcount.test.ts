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
});
