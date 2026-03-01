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

// ---------------------------------------------------------------------------
// Bug regression: phantom createEntry on empty-day navigation (Bug 1)
//
// When loading an empty day, setContent('') propagates through DiaryEditor's
// createEffect → editor.commands.setContent('') → TipTap fires onUpdate with
// empty HTML. handleContentUpdate must NOT call createEntry in that case.
//
// Gate logic mirrors handleContentUpdate in EditorPanel.tsx:
//   const isEmpty = editor ? editor.isEmpty || editor.getText().trim() === '' : content.trim() === '';
//   if (isEmpty || isCreatingEntry) return;  ← Bug 1 fix
// ---------------------------------------------------------------------------

/** Mirrors the shouldCreateEntry gate in handleContentUpdate */
function shouldCreateOnContentUpdate(
  editor: { isEmpty: boolean; getText: () => string } | null,
  content: string,
  pendingEntryId: number | null,
  isCreatingEntry: boolean,
): boolean {
  if (pendingEntryId !== null) return false;
  const isEmpty = editor ? editor.isEmpty || editor.getText().trim() === '' : content.trim() === '';
  return !isEmpty && !isCreatingEntry;
}

describe('handleContentUpdate — shouldCreateEntry gate (Bug 1: phantom create)', () => {
  it('does NOT create when editor is empty (programmatic setContent from load)', () => {
    // Regression: TipTap fires onUpdate after setContent(''), editor.isEmpty = true.
    // Before fix: createEntry was called unconditionally when pendingEntryId = null.
    const editor = { isEmpty: true, getText: () => '' };
    expect(shouldCreateOnContentUpdate(editor, '', null, false)).toBe(false);
  });

  it('does NOT create when editor contains only whitespace', () => {
    const editor = { isEmpty: false, getText: () => '   ' };
    expect(shouldCreateOnContentUpdate(editor, '<p>   </p>', null, false)).toBe(false);
  });

  it('DOES create when editor has real content and no pending entry', () => {
    const editor = { isEmpty: false, getText: () => 'Hello' };
    expect(shouldCreateOnContentUpdate(editor, '<p>Hello</p>', null, false)).toBe(true);
  });

  it('does NOT create when entry already exists (pendingEntryId is set)', () => {
    const editor = { isEmpty: false, getText: () => 'Hello' };
    expect(shouldCreateOnContentUpdate(editor, '<p>Hello</p>', 42, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bug regression: race condition — concurrent createEntry on fast typing (Bug 3)
//
// Typing fast fires handleContentUpdate multiple times before the first
// createEntry resolves. isCreatingEntry flag must gate all subsequent calls.
// ---------------------------------------------------------------------------

describe('handleContentUpdate — isCreatingEntry guard (Bug 3: race condition)', () => {
  it('does NOT create when isCreatingEntry is true', () => {
    // Regression: a second rapid keystroke would spawn a second createEntry.
    // Before fix: multiple entries were created for a single typing session.
    const editor = { isEmpty: false, getText: () => 'He' };
    expect(shouldCreateOnContentUpdate(editor, '<p>He</p>', null, true)).toBe(false);
  });

  it('DOES create on the first keystroke (isCreatingEntry starts false)', () => {
    const editor = { isEmpty: false, getText: () => 'H' };
    expect(shouldCreateOnContentUpdate(editor, '<p>H</p>', null, false)).toBe(true);
  });

  it('does NOT create once flag is set, even with real content', () => {
    const editor = { isEmpty: false, getText: () => 'Hello world' };
    expect(shouldCreateOnContentUpdate(editor, '<p>Hello world</p>', null, true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bug regression: stale deleted-entry id (Bug 2)
//
// After deleteEntryIfEmpty succeeds, pendingEntryId must be reset to null and
// the deleted entry removed from dayEntries. If not, subsequent keystrokes call
// saveEntry(deletedId, ...) which silently updates 0 rows.
// ---------------------------------------------------------------------------

/** Mirrors the post-delete state update in saveCurrentById */
function applyDeletedEntryState(
  entries: { id: number }[],
  deletedId: number,
): { pendingEntryId: null; dayEntries: { id: number }[] } {
  return {
    pendingEntryId: null,
    dayEntries: entries.filter((e) => e.id !== deletedId),
  };
}

describe('saveCurrentById post-delete state reset (Bug 2: stale id)', () => {
  it('resets pendingEntryId to null after delete', () => {
    // Regression: pendingEntryId was never reset, so the next keystroke called
    // saveEntry with the id of a row that no longer existed.
    const result = applyDeletedEntryState([{ id: 7 }], 7);
    expect(result.pendingEntryId).toBeNull();
  });

  it('removes the deleted entry from dayEntries', () => {
    const entries = [{ id: 7 }, { id: 8 }];
    const result = applyDeletedEntryState(entries, 7);
    expect(result.dayEntries).toEqual([{ id: 8 }]);
  });

  it('leaves dayEntries empty when the only entry is deleted', () => {
    const result = applyDeletedEntryState([{ id: 3 }], 3);
    expect(result.dayEntries).toHaveLength(0);
  });

  it('leaves dayEntries unchanged when deleted id is not present', () => {
    // Defensive: deleteEntryIfEmpty may return false (row already gone) but
    // the state should still be cleaned up correctly.
    const entries = [{ id: 5 }, { id: 6 }];
    const result = applyDeletedEntryState(entries, 99);
    expect(result.dayEntries).toEqual(entries);
  });
});
