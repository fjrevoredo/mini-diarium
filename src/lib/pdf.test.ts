import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectSnapPoints, computePageSplits, findSafeRasterSplit } from './pdf';

const PAGE = 257; // CONTENT_HEIGHT_MM

describe('computePageSplits', () => {
  it('single short content — no split needed', () => {
    expect(computePageSplits(100, [], [])).toEqual([0, 100]);
  });

  it('exactly two pages of content with no snap points or images', () => {
    expect(computePageSplits(PAGE * 2, [], [])).toEqual([0, PAGE, PAGE * 2]);
  });

  it('snaps to last snap point inside the page', () => {
    // Total = PAGE + 50 → one split needed. Snap point at 240 fits before PAGE.
    const total = PAGE + 50;
    const splits = computePageSplits(total, [], [240]);
    expect(splits).toEqual([0, 240, total]);
  });

  it('uses an early safe point instead of cutting at an unsafe nominal boundary', () => {
    // Correctness takes priority over page fullness: the raw PAGE boundary is not known safe.
    const total = PAGE + 50;
    const splits = computePageSplits(total, [], [100]);
    expect(splits).toEqual([0, 100, total]);
  });

  it('image retreats split; snap still applies to retreated position', () => {
    // Image straddles PAGE (top=230, bottom=280) → next retreats to 230.
    // Snap at 220 fits before 230 → snaps to 220.
    const total = PAGE + 50;
    const splits = computePageSplits(total, [{ topMm: 230, bottomMm: 280 }], [220]);
    expect(splits).toEqual([0, 220, total]);
  });

  it('image taller than page falls back to raw page boundary; snap still applies', () => {
    // Image spans 0→300 (taller than page) — can't avoid; next resets to cursor+PAGE.
    // Snap at 240 fits before the raw boundary → snaps to 240.
    const total = PAGE + 50;
    const splits = computePageSplits(total, [{ topMm: 0, bottomMm: 300 }], [240]);
    expect(splits).toEqual([0, 240, total]);
  });

  it('snap point exactly at page boundary counts as snappable', () => {
    // Snap at exactly PAGE: bb <= next (PAGE <= PAGE) → snap.
    const total = PAGE + 50;
    const splits = computePageSplits(total, [], [PAGE]);
    expect(splits).toEqual([0, PAGE, total]);
  });

  it('multiple snap points — picks the last one that fits before next', () => {
    // Points at 200 and 240 — both fit before PAGE; 240 is the last → snap to 240.
    const total = PAGE + 50;
    const splits = computePageSplits(total, [], [200, 240]);
    expect(splits).toEqual([0, 240, total]);
  });

  it('line-level snap points handle paragraph taller than one page', () => {
    // Block spans 0–320mm (longer than PAGE=257). With only the block bottom [320],
    // no snap fits inside the first page → raw cut at PAGE (mid-paragraph). With line
    // snap points every 25mm the algorithm retreats to 250mm (last line before PAGE).
    const lineAndBlockSnaps = [...Array.from({ length: 12 }, (_, i) => (i + 1) * 25), 320];
    const total = 370;
    const splits = computePageSplits(total, [], lineAndBlockSnaps);
    // Snap points in (0, 257]: 25, 50, ..., 250 — last is 250.
    expect(splits).toEqual([0, 250, total]);
  });
});

describe('collectSnapPoints', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function makeContainerWithParagraph() {
    const root = document.createElement('div');
    const content = document.createElement('div');
    content.className = 'md-print-entry-content';
    const para = document.createElement('p');
    content.appendChild(para);
    root.appendChild(content);
    document.body.appendChild(root);
    return { root, para };
  }

  it('returns only block bottom when Range rects and computed lineHeight are both unavailable', () => {
    const { root, para } = makeContainerWithParagraph();
    vi.spyOn(para, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
      left: 0,
      right: 650,
      width: 650,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [] as unknown as DOMRectList,
    } as unknown as Range);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: 'normal',
    } as CSSStyleDeclaration);

    const points = collectSnapPoints(root, 0, 1);
    expect(points).toEqual([100]);
  });

  it('falls back to line-height arithmetic when Range.getClientRects returns empty (off-viewport content in fixed containers)', () => {
    // Chromium skips inline box layout for position:fixed content below the viewport.
    // When Range.getClientRects() returns [], we must compute line positions from
    // the element height and computed line-height so tall paragraphs still get
    // granular snap points across page boundaries.
    const { root, para } = makeContainerWithParagraph();
    vi.spyOn(para, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 300,
      left: 0,
      right: 650,
      width: 650,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [] as unknown as DOMRectList,
    } as unknown as Range);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: '25px',
    } as CSSStyleDeclaration);

    const points = collectSnapPoints(root, 0, 1);
    // Arithmetic snap points: 25, 50, 75, …, 300 (plus block bottom 300 — may duplicate).
    expect(points).toContain(25);
    expect(points).toContain(50);
    expect(points).toContain(75);
    expect(points).toContain(300);
    expect(points.length).toBeGreaterThanOrEqual(5);
  });

  it('ignores garbage Range rects for zero-height elements and uses offsetHeight for line arithmetic', () => {
    // Chromium returns rect.height=0 for off-screen position:fixed elements, and
    // Range.getClientRects() returns garbage positions (e.g. 15895px, 42px) for them.
    // We must not use those garbage rects as snap points.
    const { root, para } = makeContainerWithParagraph();
    vi.spyOn(para, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 100, // zero height — Chromium culls off-screen fixed content
      height: 0,
      left: 0,
      right: 650,
      width: 650,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    // offsetHeight gives the true layout height (layout box, not viewport-clamped).
    Object.defineProperty(para, 'offsetHeight', { get: () => 300, configurable: true });
    // Chromium returns garbage rects for off-screen position:fixed content.
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () =>
        [
          { top: 0, bottom: 15895, left: 0, right: 650, width: 650, height: 15895 },
          { top: 0, bottom: 42, left: 0, right: 650, width: 650, height: 42 },
          { top: 0, bottom: 3897, left: 0, right: 650, width: 650, height: 3897 },
        ] as unknown as DOMRectList,
    } as unknown as Range);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: '25px',
    } as CSSStyleDeclaration);

    const points = collectSnapPoints(root, 0, 1);
    // Garbage snap values must NOT appear.
    expect(points).not.toContain(15895);
    expect(points).not.toContain(42);
    expect(points).not.toContain(3897);
    // Block bottom at 100 + 300 = 400 (uses offsetHeight as height).
    expect(points).toContain(400);
    // Line arithmetic snaps: 125, 150, …, 400.
    expect(points).toContain(125);
    expect(points).toContain(150);
    expect(points.length).toBeGreaterThanOrEqual(12);
  });

  it('includes whitespace positions between visual lines from Range.getClientRects', () => {
    const { root, para } = makeContainerWithParagraph();
    vi.spyOn(para, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 300,
      left: 0,
      right: 650,
      width: 650,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () =>
        [
          { top: 0, bottom: 90, left: 0, right: 650, width: 650, height: 90 },
          { top: 110, bottom: 190, left: 0, right: 650, width: 650, height: 80 },
          { top: 210, bottom: 290, left: 0, right: 650, width: 650, height: 80 },
        ] as unknown as DOMRectList,
    } as unknown as Range);

    const points = collectSnapPoints(root, 0, 1);
    // Safe cuts are centered in whitespace, never on the rendered text bounds.
    expect(points).toContain(100);
    expect(points).toContain(200);
    expect(points).toContain(300);
    expect(points).toHaveLength(3);
  });

  it('does not treat inline fragment bottoms inside the same visual line as safe cuts', () => {
    const { root, para } = makeContainerWithParagraph();
    vi.spyOn(para, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
      left: 0,
      right: 650,
      width: 650,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () =>
        [
          // The first two rects are differently-sized inline fragments on one line.
          { top: 10, bottom: 30, left: 0, right: 300, width: 300, height: 20 },
          { top: 16, bottom: 27, left: 300, right: 400, width: 100, height: 11 },
          // The next visual line starts below the first line.
          { top: 40, bottom: 60, left: 0, right: 300, width: 300, height: 20 },
        ] as unknown as DOMRectList,
    } as unknown as Range);

    const points = collectSnapPoints(root, 0, 1);

    expect(points).not.toContain(27);
    expect(points).not.toContain(30);
    expect(points).toContain(35);
    expect(points).toContain(100);
  });
});

describe('findSafeRasterSplit', () => {
  it('finds the last blank band before rendered text reaches the page edge', () => {
    const width = 4;
    const height = 12;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const paintRow = (row: number) => {
      for (let x = 0; x < width; x++) {
        const index = (row * width + x) * 4;
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      }
    };
    paintRow(8);
    paintRow(9);
    paintRow(10);
    paintRow(11);

    expect(findSafeRasterSplit(pixels, width, height, 4, [])).toBe(6);
  });

  it('does not select blank rows inside an image', () => {
    const width = 4;
    const height = 12;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);

    expect(findSafeRasterSplit(pixels, width, height, 4, [{ top: 7, bottom: 11 }])).toBe(5);
  });
});
