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
});
