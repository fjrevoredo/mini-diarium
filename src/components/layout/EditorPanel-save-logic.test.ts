import { describe, it, expect } from 'vitest';

/**
 * Regression tests for the empty-entry detection logic in EditorPanel.tsx
 * (Issue #22 — spurious calendar dot on empty dates).
 *
 * TipTap cannot run in jsdom, so these tests validate the isContentEmpty
 * logic pattern using mock editor objects, mirroring the approach in
 * MainLayout-event-listeners.test.tsx.
 *
 * Root cause: TipTap normalises '' to '<p></p>' and fires onUpdate, so
 * `!content.trim()` was always false for empty documents — the old check
 * incorrectly fell through to saveEntry() instead of deleteEntryIfEmpty().
 *
 * Fix: use `editor.isEmpty || editor.getText().trim() === ''` when the
 * editor is alive; fall back to `!currentContent.trim()` only when destroyed.
 */

/** Mirrors the isContentEmpty logic in EditorPanel.tsx:saveCurrentEntry() */
function isContentEmpty(
  editor: { isEmpty: boolean; isDestroyed: boolean; getText: () => string } | null,
  currentContent: string,
): boolean {
  return editor && !editor.isDestroyed
    ? editor.isEmpty || editor.getText().trim() === ''
    : !currentContent.trim();
}

// ---------------------------------------------------------------------------
// Editor alive
// ---------------------------------------------------------------------------

describe('isContentEmpty — editor alive', () => {
  it('returns true for a fully empty TipTap document (<p></p>)', () => {
    // Regression: this was the bug — <p></p>.trim() is truthy so the old
    // string check returned false, causing saveEntry() to be called.
    const editor = { isEmpty: true, isDestroyed: false, getText: () => '' };
    expect(isContentEmpty(editor, '<p></p>')).toBe(true);
  });

  it('returns true for whitespace-only content', () => {
    // getText() strips HTML tags; trimming catches spaces/tabs/newlines.
    const editor = { isEmpty: false, isDestroyed: false, getText: () => '   ' };
    expect(isContentEmpty(editor, '<p>   </p>')).toBe(true);
  });

  it('returns false when real text is present', () => {
    const editor = { isEmpty: false, isDestroyed: false, getText: () => 'Hello world' };
    expect(isContentEmpty(editor, '<p>Hello world</p>')).toBe(false);
  });

  it('returns false when only formatting marks remain (bold wrapper, etc.)', () => {
    const editor = { isEmpty: false, isDestroyed: false, getText: () => 'Important' };
    expect(isContentEmpty(editor, '<p><strong>Important</strong></p>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Editor destroyed (teardown fallback path)
// ---------------------------------------------------------------------------

describe('isContentEmpty — editor destroyed (fallback)', () => {
  it('returns true when content signal is empty string', () => {
    const editor = { isEmpty: false, isDestroyed: true, getText: () => '' };
    expect(isContentEmpty(editor, '')).toBe(true);
  });

  it('returns false when content signal holds <p></p> (best-effort limitation)', () => {
    // Documented limitation: during teardown the editor is gone so we cannot
    // call editor.isEmpty; the raw string <p></p> is non-empty after trim().
    // This narrow race (navigate to empty date → lock within 500 ms) is
    // accepted as best-effort behaviour.
    const editor = { isEmpty: false, isDestroyed: true, getText: () => '' };
    expect(isContentEmpty(editor, '<p></p>')).toBe(false);
  });

  it('returns false when content signal holds real text', () => {
    const editor = { isEmpty: false, isDestroyed: true, getText: () => '' };
    expect(isContentEmpty(editor, '<p>Hello</p>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Editor null (before onEditorReady fires)
// ---------------------------------------------------------------------------

describe('isContentEmpty — editor null', () => {
  it('returns true when content is empty string', () => {
    expect(isContentEmpty(null, '')).toBe(true);
  });

  it('returns false when content signal holds <p></p>', () => {
    expect(isContentEmpty(null, '<p></p>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveCurrentEntry branching — should call deleteEntryIfEmpty not saveEntry
// ---------------------------------------------------------------------------

describe('saveCurrentEntry branch selection', () => {
  it('routes to delete branch when editor is empty and title is blank', () => {
    const editor = { isEmpty: true, isDestroyed: false, getText: () => '' };
    const currentTitle = '';
    const empty = isContentEmpty(editor, '<p></p>');

    // Verify the branch condition used in saveCurrentEntry
    expect(!currentTitle.trim() && empty).toBe(true);
  });

  it('routes to save branch when title is non-empty even if editor is empty', () => {
    const editor = { isEmpty: true, isDestroyed: false, getText: () => '' };
    const currentTitle = 'My title';
    const empty = isContentEmpty(editor, '<p></p>');

    expect(!currentTitle.trim() && empty).toBe(false);
  });

  it('routes to save branch when editor has content even if title is blank', () => {
    const editor = { isEmpty: false, isDestroyed: false, getText: () => 'Some text' };
    const currentTitle = '';
    const empty = isContentEmpty(editor, '<p>Some text</p>');

    expect(!currentTitle.trim() && empty).toBe(false);
  });
});
