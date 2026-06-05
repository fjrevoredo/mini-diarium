import { describe, expect, it } from 'vitest';
import { normalizeSafeLink } from './safe-links';

describe('normalizeSafeLink', () => {
  it('accepts allowed protocols unchanged', () => {
    expect(normalizeSafeLink('https://example.com')).toBe('https://example.com');
    expect(normalizeSafeLink('mailto:user@example.com')).toBe('mailto:user@example.com');
    expect(normalizeSafeLink('tel:+123456789')).toBe('tel:+123456789');
  });

  it('normalizes bare domains, emails, and phone numbers', () => {
    expect(normalizeSafeLink('example.com')).toBe('https://example.com');
    expect(normalizeSafeLink('user@example.com')).toBe('mailto:user@example.com');
    expect(normalizeSafeLink('+1 234 567 8901')).toBe('tel:+12345678901');
  });

  it('rejects unsafe protocols', () => {
    expect(normalizeSafeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeSafeLink('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeSafeLink('file:///tmp/test.txt')).toBeNull();
  });

  it('rejects blank input', () => {
    expect(normalizeSafeLink('')).toBeNull();
    expect(normalizeSafeLink('   ')).toBeNull();
  });
});
