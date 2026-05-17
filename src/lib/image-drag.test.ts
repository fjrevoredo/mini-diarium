import { describe, it, expect } from 'vitest';
import { extractImageSourcesFromHtml, htmlHasImages } from './image-drag';

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

describe('extractImageSourcesFromHtml', () => {
  it('returns empty sources for empty string', () => {
    expect(extractImageSourcesFromHtml('')).toEqual({ dataUrls: [], filePaths: [] });
  });

  it('returns empty sources for HTML with no <img> tags', () => {
    expect(extractImageSourcesFromHtml('<p>Hello world</p>')).toEqual({
      dataUrls: [],
      filePaths: [],
    });
  });

  it('skips <img src="https://..."> (HTTPS not fetchable)', () => {
    const result = extractImageSourcesFromHtml('<img src="https://example.com/image.png">');
    expect(result).toEqual({ dataUrls: [], filePaths: [] });
  });

  it('skips <img src="http://..."> (HTTP not fetchable)', () => {
    const result = extractImageSourcesFromHtml('<img src="http://example.com/image.png">');
    expect(result).toEqual({ dataUrls: [], filePaths: [] });
  });

  it('extracts data:image/png;base64,... src into dataUrls', () => {
    const result = extractImageSourcesFromHtml(`<img src="${PNG_DATA_URL}">`);
    expect(result).toEqual({ dataUrls: [PNG_DATA_URL], filePaths: [] });
  });

  it('extracts data:image/jpeg;base64,... src into dataUrls', () => {
    const result = extractImageSourcesFromHtml(`<img src="${JPEG_DATA_URL}">`);
    expect(result).toEqual({ dataUrls: [JPEG_DATA_URL], filePaths: [] });
  });

  it('extracts multiple data URL images into dataUrls', () => {
    const html = `<img src="${PNG_DATA_URL}"><img src="${JPEG_DATA_URL}">`;
    const { dataUrls } = extractImageSourcesFromHtml(html);
    expect(dataUrls).toHaveLength(2);
    expect(dataUrls[0]).toBe(PNG_DATA_URL);
    expect(dataUrls[1]).toBe(JPEG_DATA_URL);
  });

  it('ignores data:text/html and data:application/ srcs', () => {
    const html =
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="><img src="data:application/pdf;base64,JVBERi0=">';
    expect(extractImageSourcesFromHtml(html)).toEqual({ dataUrls: [], filePaths: [] });
  });

  it('handles attributes before and after src', () => {
    const result = extractImageSourcesFromHtml(
      `<img class="photo" alt="test" src="${PNG_DATA_URL}" width="100">`,
    );
    expect(result.dataUrls).toEqual([PNG_DATA_URL]);
  });

  it('handles nested elements (img inside anchor inside div)', () => {
    const result = extractImageSourcesFromHtml(
      `<div><a href="#"><img src="${PNG_DATA_URL}"></a></div>`,
    );
    expect(result.dataUrls).toEqual([PNG_DATA_URL]);
  });

  it('does not throw on malformed HTML', () => {
    expect(() => extractImageSourcesFromHtml('<img src="data:image/png;base64,abc')).not.toThrow();
    expect(() => extractImageSourcesFromHtml('<<<not valid html>>>')).not.toThrow();
  });

  it('returns empty sources for plain text (no img tags)', () => {
    expect(extractImageSourcesFromHtml('just some plain text content')).toEqual({
      dataUrls: [],
      filePaths: [],
    });
  });

  it('extracts Unix file:// URL with image extension into filePaths', () => {
    const { filePaths } = extractImageSourcesFromHtml('<img src="file:///home/user/photo.png">');
    expect(filePaths).toEqual(['/home/user/photo.png']);
  });

  it('extracts Windows file:// URL into filePaths', () => {
    const { filePaths } = extractImageSourcesFromHtml(
      '<img src="file:///C:/Users/user/photo.jpg">',
    );
    expect(filePaths).toEqual(['C:/Users/user/photo.jpg']);
  });

  it('decodes percent-encoded spaces in file:// paths', () => {
    const { filePaths } = extractImageSourcesFromHtml(
      '<img src="file:///C:/My%20Documents/photo.png">',
    );
    expect(filePaths).toEqual(['C:/My Documents/photo.png']);
  });

  it('skips file:// URLs with non-image extensions', () => {
    const { filePaths } = extractImageSourcesFromHtml('<img src="file:///home/user/document.pdf">');
    expect(filePaths).toEqual([]);
  });

  it('mixes data URLs and file paths from one HTML string', () => {
    const html = `<img src="${PNG_DATA_URL}"><img src="file:///home/user/photo.jpg">`;
    const { dataUrls, filePaths } = extractImageSourcesFromHtml(html);
    expect(dataUrls).toEqual([PNG_DATA_URL]);
    expect(filePaths).toEqual(['/home/user/photo.jpg']);
  });
});

describe('htmlHasImages', () => {
  it('returns false for empty string', () => {
    expect(htmlHasImages('')).toBe(false);
  });

  it('returns false for HTML with no img tags', () => {
    expect(htmlHasImages('<p>hello</p>')).toBe(false);
  });

  it('returns true for HTML with an HTTPS img tag', () => {
    expect(htmlHasImages('<img src="https://example.com/image.png">')).toBe(true);
  });

  it('returns true for HTML with a data URL img tag', () => {
    expect(htmlHasImages(`<img src="${PNG_DATA_URL}">`)).toBe(true);
  });
});
