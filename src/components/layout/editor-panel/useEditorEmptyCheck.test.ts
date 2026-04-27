import { describe, it, expect } from 'vitest';
import type { Editor } from '@tiptap/core';
import { computeIsEmpty, editorHasImages } from './useEditorEmptyCheck';

/**
 * Tests for the emptiness check extracted into the useEditorEmptyCheck hook.
 * TipTap cannot run in jsdom, so these tests drive `computeIsEmpty` with a
 * minimal mock editor that honours the surface the function reads.
 *
 * Regression: TipTap normalises '' to '<p></p>' and fires onUpdate, so
 * `!content.trim()` was always false for empty documents — the naive string
 * check incorrectly fell through to saveEntry() instead of deleteEntryIfEmpty().
 *
 * Fix: use `editor.isEmpty || editor.getText().trim() === ''` when the editor
 * is alive; fall back to `!currentContent.trim()` only when destroyed/null.
 */

interface MockEditorShape {
  isEmpty: boolean;
  isDestroyed: boolean;
  getText: () => string;
  /** Image descendants list; empty by default. */
  images?: unknown[];
}

function makeEditor(mock: MockEditorShape): Editor {
  const nodes = (mock.images ?? []).map((_) => ({ type: { name: 'image' } }));
  return {
    isEmpty: mock.isEmpty,
    isDestroyed: mock.isDestroyed,
    getText: mock.getText,
    state: {
      doc: {
        descendants: (cb: (n: { type: { name: string } }) => void) => {
          nodes.forEach(cb);
        },
      },
    },
  } as unknown as Editor;
}

// ---------------------------------------------------------------------------
// Editor alive
// ---------------------------------------------------------------------------

describe('computeIsEmpty — editor alive', () => {
  it('returns true for a fully empty TipTap document (<p></p>)', () => {
    const editor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });
    expect(computeIsEmpty(editor, '<p></p>')).toBe(true);
  });

  it('returns true for whitespace-only content', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => '   ' });
    expect(computeIsEmpty(editor, '<p>   </p>')).toBe(true);
  });

  it('returns false when real text is present', () => {
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    });
    expect(computeIsEmpty(editor, '<p>Hello world</p>')).toBe(false);
  });

  it('returns false when only formatting marks remain (bold wrapper, etc.)', () => {
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Important',
    });
    expect(computeIsEmpty(editor, '<p><strong>Important</strong></p>')).toBe(false);
  });

  it('returns false when the document has an image but no text (image-only entry)', () => {
    // Regression: a picture-only entry has empty getText() but must not be treated as blank.
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => '',
      images: [{}],
    });
    expect(computeIsEmpty(editor, '<figure class="image-container"><img src="…" /></figure>')).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Editor destroyed (teardown fallback path)
// ---------------------------------------------------------------------------

describe('computeIsEmpty — editor destroyed (fallback)', () => {
  it('returns true when content signal is empty string', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: true, getText: () => '' });
    expect(computeIsEmpty(editor, '')).toBe(true);
  });

  it('returns false when content signal holds <p></p> (best-effort limitation)', () => {
    // Documented limitation: during teardown the editor is gone so we cannot
    // call editor.isEmpty; the raw string <p></p> is non-empty after trim().
    // This narrow race (navigate to empty date → lock within 500 ms) is
    // accepted as best-effort behaviour.
    const editor = makeEditor({ isEmpty: false, isDestroyed: true, getText: () => '' });
    expect(computeIsEmpty(editor, '<p></p>')).toBe(false);
  });

  it('returns false when content signal holds real text', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: true, getText: () => '' });
    expect(computeIsEmpty(editor, '<p>Hello</p>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Editor null (before onEditorReady fires)
// ---------------------------------------------------------------------------

describe('computeIsEmpty — editor null', () => {
  it('returns true when content is empty string', () => {
    expect(computeIsEmpty(null, '')).toBe(true);
  });

  it('returns false when content signal holds <p></p>', () => {
    expect(computeIsEmpty(null, '<p></p>')).toBe(false);
  });

  it('returns false when content is non-empty', () => {
    expect(computeIsEmpty(null, '<p>Hello</p>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// editorHasImages — image detection
// ---------------------------------------------------------------------------

describe('editorHasImages', () => {
  it('returns false when the document has no image nodes', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => 'Hi' });
    expect(editorHasImages(editor)).toBe(false);
  });

  it('returns true when the document contains at least one image node', () => {
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => '',
      images: [{}],
    });
    expect(editorHasImages(editor)).toBe(true);
  });

  it('returns true when the document contains multiple image nodes', () => {
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'caption',
      images: [{}, {}, {}],
    });
    expect(editorHasImages(editor)).toBe(true);
  });
});
