import { describe, it, expect } from 'vitest';
import { hasImageRefs, resolveImageRefs } from './image-refs';
import type { ImageData } from './tauri';

const fakeImage = (id: number): ImageData => ({
  id,
  mime_type: 'image/png',
  data_base64: 'abc123',
});

describe('hasImageRefs', () => {
  it('returns true when text contains an image-id:// ref', () => {
    expect(hasImageRefs('<img src="image-id://1">')).toBe(true);
  });

  it('returns false when no image-id:// refs are present', () => {
    expect(hasImageRefs('<img src="data:image/png;base64,abc">')).toBe(false);
  });
});

describe('resolveImageRefs', () => {
  it('replaces double-quoted image-id:// ref with a data URL', () => {
    const html = `<img src="image-id://1" alt="">`;
    const result = resolveImageRefs(html, [fakeImage(1)]);
    expect(result).toContain('data:image/png;base64,abc123');
    expect(result).not.toContain('image-id://');
  });

  it('replaces single-quoted image-id:// ref with a data URL', () => {
    const html = `<img src='image-id://1' alt=''>`;
    const result = resolveImageRefs(html, [fakeImage(1)]);
    expect(result).toContain('data:image/png;base64,abc123');
    expect(result).not.toContain('image-id://');
  });

  it('does not match a longer ID (image-id://5 must not match image-id://50)', () => {
    const html = `<img src="image-id://50" alt="">`;
    const result = resolveImageRefs(html, [fakeImage(5)]);
    expect(result).toContain('image-id://50');
  });

  it('replaces multiple refs in the same string', () => {
    const html = `<img src="image-id://1"><img src='image-id://2'>`;
    const result = resolveImageRefs(html, [fakeImage(1), fakeImage(2)]);
    expect(result).not.toContain('image-id://');
    expect(result.split('data:image/png;base64,abc123').length - 1).toBe(2);
  });

  it('leaves HTML unchanged when images array is empty', () => {
    const html = `<img src="image-id://1" alt="">`;
    expect(resolveImageRefs(html, [])).toBe(html);
  });
});
