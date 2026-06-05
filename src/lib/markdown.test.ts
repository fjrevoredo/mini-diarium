import { describe, it, expect } from 'vitest';
import { parseMarkdownToHtml } from './markdown';

describe('parseMarkdownToHtml', () => {
  it('converts an h1 heading', () => {
    const html = parseMarkdownToHtml('# Hello');
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('converts bold text', () => {
    const html = parseMarkdownToHtml('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('converts a fenced code block', () => {
    const html = parseMarkdownToHtml('```\ncode here\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code>');
  });

  it('returns empty string for empty input', () => {
    expect(parseMarkdownToHtml('')).toBe('');
  });

  it('strips <script> tags embedded in markdown (security)', () => {
    const html = parseMarkdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('converts a named link [label](url) to <a href="...">label</a>', () => {
    const html = parseMarkdownToHtml('See [Visit site](https://example.com) please');
    expect(html).toContain('<a href="https://example.com">Visit site</a>');
  });

  it('preserves the link href against DOMPurify sanitization', () => {
    const html = parseMarkdownToHtml('[label](https://example.com)');
    // The anchor element survives sanitization with its href intact
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com"[^>]*>label<\/a>/);
  });

  it('strips javascript: URLs from links (security)', () => {
    const html = parseMarkdownToHtml('[click](javascript:alert(1))');
    // DOMPurify removes the unsafe href; the label text remains.
    expect(html).not.toContain('javascript:');
  });
});
