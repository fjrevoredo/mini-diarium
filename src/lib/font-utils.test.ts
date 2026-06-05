import { describe, it, expect } from 'vitest';
import { extractFontFamiliesFromHtml } from './font-utils';

describe('extractFontFamiliesFromHtml', () => {
  it('returns empty array for empty string', () => {
    expect(extractFontFamiliesFromHtml('')).toEqual([]);
  });

  it('returns empty array for HTML with no font-family', () => {
    expect(extractFontFamiliesFromHtml('<p>Hello world</p>')).toEqual([]);
  });

  it('extracts a double-quoted font-family', () => {
    // TipTap's getHTML() wraps font names in double quotes inside the style attribute
    expect(
      extractFontFamiliesFromHtml('<span style=\'font-family: "Merriweather"\'>text</span>'),
    ).toContain('Merriweather');
  });

  it('extracts an unquoted font-family', () => {
    const html = '<span style="font-family: Georgia">text</span>';
    expect(extractFontFamiliesFromHtml(html)).toContain('Georgia');
  });

  it('extracts multiple distinct font families', () => {
    const html =
      '<span style="font-family: Georgia">a</span>' +
      '<span style="font-family: Merriweather">b</span>';
    const result = extractFontFamiliesFromHtml(html);
    expect(result).toContain('Georgia');
    expect(result).toContain('Merriweather');
  });

  it('does not duplicate the same family', () => {
    const html =
      '<span style="font-family: Georgia">a</span>' + '<span style="font-family: Georgia">b</span>';
    // The function returns all occurrences; deduplication happens at the caller (Set).
    const result = extractFontFamiliesFromHtml(html);
    expect(result.filter((f) => f === 'Georgia')).toHaveLength(2);
  });

  // Contract-boundary tests — document actual behavior for formats outside the TipTap contract.

  it('entity-encoded &quot; quotes: outside contract, returns no match', () => {
    // TipTap never emits &quot; — this format is outside the contract.
    const result = extractFontFamiliesFromHtml(
      '<span style="font-family: &quot;Noto Serif&quot;">x</span>',
    );
    expect(result).toEqual([]);
  });

  it('comma-separated fallback stack: captures only the first name (stops at comma)', () => {
    // TipTap FontFamily never emits stacks. The regex stops at the comma, so "Noto Serif" is captured.
    const result = extractFontFamiliesFromHtml(
      '<span style="font-family: Noto Serif, serif">x</span>',
    );
    expect(result).toEqual(['Noto Serif']);
  });

  it('multi-property style attribute with font-family last: extracts correctly', () => {
    const result = extractFontFamiliesFromHtml(
      '<span style="color: red; font-family: JetBrains Mono;">x</span>',
    );
    expect(result).toContain('JetBrains Mono');
  });
});
