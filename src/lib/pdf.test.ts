import { describe, expect, it } from 'vitest';
import { findSafeRasterSplit } from './pdf';

function whiteRaster(width: number, height: number) {
  return new Uint8ClampedArray(width * height * 4).fill(255);
}

function paintRows(pixels: Uint8ClampedArray, width: number, rows: number[]) {
  for (const row of rows) {
    for (let column = 0; column < width; column++) {
      const index = (row * width + column) * 4;
      pixels[index] = 0;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
    }
  }
}

describe('findSafeRasterSplit', () => {
  it('selects the final blank band before content reaches the page edge', () => {
    const width = 4;
    const height = 12;
    const pixels = whiteRaster(width, height);
    paintRows(pixels, width, [8, 9, 10, 11]);

    expect(findSafeRasterSplit(pixels, width, height, 4, [])).toBe(6);
  });

  it('ignores blank rows that belong to an image', () => {
    const width = 4;
    const height = 12;

    expect(
      findSafeRasterSplit(whiteRaster(width, height), width, height, 4, [{ top: 7, bottom: 11 }]),
    ).toBe(6);
  });

  it('returns undefined when no safe band exists in the permitted range', () => {
    const width = 4;
    const height = 12;
    const pixels = whiteRaster(width, height);
    paintRows(pixels, width, [4, 5, 6, 7, 8, 9, 10, 11]);

    expect(findSafeRasterSplit(pixels, width, height, 4, [])).toBeUndefined();
  });

  it('can retreat before an image that occupies more than half the page', () => {
    const width = 4;
    const height = 12;

    expect(
      findSafeRasterSplit(whiteRaster(width, height), width, height, 0, [{ top: 2, bottom: 12 }]),
    ).toBe(1);
  });
});
