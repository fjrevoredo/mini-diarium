import { describe, it, expect } from 'vitest';

/**
 * Regression tests for the "+" button permanently disabled bugs.
 *
 * Bug 1 — navigation arrow: `isContentEmpty()` reads `editor.isEmpty` (TipTap's
 * internal state) directly. When SolidJS reactively re-evaluates `addDisabled` in
 * response to `setPendingEntryId()` changing, TipTap has NOT yet processed the newly
 * loaded entry's content (that happens later in DiaryEditor's createEffect). So
 * `editor.isEmpty` is stale — still `true` from the blank entry — making `addDisabled`
 * stuck at `true`.
 *
 * Fix: `editorIsEmpty` SolidJS signal updated in `handleContentUpdate` (TipTap's
 * `onUpdate`). `isContentEmpty()` tracks this signal, forcing re-evaluation AFTER
 * TipTap has processed content — at which point `editor.isEmpty` is correct.
 *
 * Bug 2 — day switch: after clicking "+" on a 1-entry day, switching to a different
 * day without typing, then switching back, the blank entry is auto-deleted by the
 * debounced save. `saveCurrentById` previously set `pendingEntryId=null` and left the
 * editor showing stale blank content even though the original real entry still exists.
 * The "+" button got stuck because `pendingEntryId===null`.
 *
 * Fix: when other entries remain after auto-deletion, navigate to the nearest one
 * so `pendingEntryId` is always set to a real entry and the editor shows real content.
 *
 * TipTap cannot run in jsdom, so these tests validate the logic as pure functions,
 * mirroring the approach in EditorPanel-save-logic.test.ts.
 */

// ---------------------------------------------------------------------------
// Helpers mirroring EditorPanel internals
// ---------------------------------------------------------------------------

type MockEditor = {
  isEmpty: boolean;
  isDestroyed: boolean;
  getText: () => string;
};

/**
 * Mirrors the `editorIsEmpty` signal update inside `handleContentUpdate`.
 * Returns the new value to set on the `editorIsEmpty` signal.
 */
function computeEditorIsEmpty(editor: MockEditor | null, newContent: string): boolean {
  if (editor && !editor.isDestroyed) {
    return editor.isEmpty || editor.getText().trim() === '';
  }
  return newContent.trim() === '';
}

/**
 * Mirrors `isContentEmpty()` in EditorPanel.tsx (with the fix applied).
 * `editorIsEmpty` is just a reactive trigger — it causes re-evaluation, but
 * the actual check still reads `editor.isEmpty` from TipTap.
 *
 * In the real component, `editorIsEmpty()` is accessed to add it to the
 * SolidJS dependency list. The return value of `isContentEmpty()` comes from
 * `editor.isEmpty` / `editor.getText()`, not from the signal's stored value.
 */
function isContentEmpty(editor: MockEditor | null, currentContent: string): boolean {
  if (editor && !editor.isDestroyed) {
    return editor.isEmpty || editor.getText().trim() === '';
  }
  return !currentContent.trim();
}

/**
 * Mirrors the `addDisabled` prop computation in EditorPanel's JSX.
 */
function computeAddDisabled(params: {
  isCreatingEntry: boolean;
  pendingEntryId: number | null;
  editor: MockEditor | null;
  currentContent: string;
}): boolean {
  return (
    params.isCreatingEntry ||
    params.pendingEntryId === null ||
    isContentEmpty(params.editor, params.currentContent)
  );
}

// ---------------------------------------------------------------------------
// Test group 1: editorIsEmpty signal update logic
//
// Mirrors the update inside handleContentUpdate() — called whenever TipTap
// fires onUpdate. The signal reflects the actual TipTap document state so
// that addDisabled re-evaluates with the correct value.
// ---------------------------------------------------------------------------

describe('computeEditorIsEmpty — mirrors editorIsEmpty update in handleContentUpdate', () => {
  it('returns true for a fully empty TipTap document (editor.isEmpty = true)', () => {
    const editor: MockEditor = { isEmpty: true, isDestroyed: false, getText: () => '' };
    expect(computeEditorIsEmpty(editor, '<p></p>')).toBe(true);
  });

  it('returns true for whitespace-only content', () => {
    const editor: MockEditor = { isEmpty: false, isDestroyed: false, getText: () => '   ' };
    expect(computeEditorIsEmpty(editor, '<p>   </p>')).toBe(true);
  });

  it('returns false for real text content', () => {
    const editor: MockEditor = {
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    };
    expect(computeEditorIsEmpty(editor, '<p>Hello world</p>')).toBe(false);
  });

  it('returns false when editor is destroyed and content is non-empty', () => {
    // Destroyed editor: falls back to newContent.trim() check.
    const editor: MockEditor = { isEmpty: false, isDestroyed: true, getText: () => '' };
    expect(computeEditorIsEmpty(editor, '<p>Hello</p>')).toBe(false);
  });

  it('returns true when editor is null and content is empty', () => {
    expect(computeEditorIsEmpty(null, '')).toBe(true);
  });

  it('returns false when editor is null and content is non-empty', () => {
    expect(computeEditorIsEmpty(null, '<p>Hello</p>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test group 2: the bug scenario and its fix
//
// Bug: after navigating from blank entry 2 → entry 1 (which has content),
// addDisabled gets stuck at true because:
//   a) setPendingEntryId(1) triggers re-evaluation with stale editor.isEmpty=true
//   b) TipTap later fires onUpdate, but handleContentUpdate calls setContent()
//      with the same value → no SolidJS signal change → no re-evaluation
//
// Fix: handleContentUpdate also calls setEditorIsEmpty(), which IS a new signal
// change, forcing re-evaluation AFTER TipTap has updated editor.isEmpty to false.
// ---------------------------------------------------------------------------

describe('Bug regression: "+" stuck disabled after navigating from blank entry', () => {
  it('[before fix] addDisabled is true when editorIsEmpty is stale from blank entry', () => {
    // Simulates the state at the moment setPendingEntryId(1) triggers re-evaluation:
    // - editorIsEmpty = true (set when blank entry 2 was shown)
    // - editor.isEmpty = true (TipTap still has the empty document from entry 2)
    // - pendingEntryId just changed from null → 1
    const staleEditor: MockEditor = {
      isEmpty: true, // TipTap hasn't processed entry1.text yet
      isDestroyed: false,
      getText: () => '',
    };
    const addDisabled = computeAddDisabled({
      isCreatingEntry: false,
      pendingEntryId: 1,
      editor: staleEditor,
      currentContent: '<p></p>',
    });
    expect(addDisabled).toBe(true); // WRONG — but this is the stuck state before the fix
  });

  it('[after fix] addDisabled becomes false when TipTap fires onUpdate with entry content', () => {
    // Simulates the state AFTER TipTap fires onUpdate with entry1.text:
    // - handleContentUpdate runs → setEditorIsEmpty(false) → re-evaluation triggered
    // - editor.isEmpty is now false (TipTap has processed the content)
    // - The fix ensures this re-evaluation happens (editorIsEmpty signal changed)
    const updatedEditor: MockEditor = {
      isEmpty: false, // TipTap has processed entry1.text
      isDestroyed: false,
      getText: () => 'Hello world',
    };
    const addDisabled = computeAddDisabled({
      isCreatingEntry: false,
      pendingEntryId: 1,
      editor: updatedEditor,
      currentContent: '<p>Hello world</p>',
    });
    expect(addDisabled).toBe(false); // Correct — "+" button is enabled
  });

  it('editorIsEmpty transitions from true to false when onUpdate fires with real content', () => {
    // This models the key state transition that the fix enables:
    // Before: editorIsEmpty = true (blank entry state)
    // After handleContentUpdate with entry1.text: editorIsEmpty = false
    const blankEditor: MockEditor = { isEmpty: true, isDestroyed: false, getText: () => '' };
    const loadedEditor: MockEditor = {
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    };

    const beforeOnUpdate = computeEditorIsEmpty(blankEditor, '<p></p>');
    const afterOnUpdate = computeEditorIsEmpty(loadedEditor, '<p>Hello world</p>');

    expect(beforeOnUpdate).toBe(true);
    expect(afterOnUpdate).toBe(false);
    // The change (true → false) is what causes SolidJS to re-evaluate addDisabled
    expect(beforeOnUpdate).not.toBe(afterOnUpdate);
  });
});

// ---------------------------------------------------------------------------
// Test group 3: addDisabled formula correctness with the fix applied
//
// addDisabled = isCreatingEntry || pendingEntryId === null || isContentEmpty()
// ---------------------------------------------------------------------------

describe('addDisabled formula — correct behavior after fix', () => {
  const nonEmptyEditor: MockEditor = {
    isEmpty: false,
    isDestroyed: false,
    getText: () => 'Hello world',
  };
  const emptyEditor: MockEditor = {
    isEmpty: true,
    isDestroyed: false,
    getText: () => '',
  };

  it('is false when entry exists, has content, and is not creating', () => {
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId: 1,
        editor: nonEmptyEditor,
        currentContent: '<p>Hello world</p>',
      }),
    ).toBe(false);
  });

  it('is true when isCreatingEntry is set (prevents double-create)', () => {
    expect(
      computeAddDisabled({
        isCreatingEntry: true,
        pendingEntryId: 1,
        editor: nonEmptyEditor,
        currentContent: '<p>Hello world</p>',
      }),
    ).toBe(true);
  });

  it('is true when pendingEntryId is null (no entry yet — first keystroke will create one)', () => {
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId: null,
        editor: nonEmptyEditor,
        currentContent: '<p>Hello world</p>',
      }),
    ).toBe(true);
  });

  it('is true when editor is empty (blank new entry — must write something first)', () => {
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId: 2,
        editor: emptyEditor,
        currentContent: '<p></p>',
      }),
    ).toBe(true);
  });

  it('is false immediately after navigating to an entry with content (post-fix state)', () => {
    // This is the exact state after the fix corrects addDisabled:
    // pendingEntryId was set by navigateToEntry, then TipTap fired onUpdate,
    // editorIsEmpty changed to false, and addDisabled re-evaluated.
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId: 1,
        editor: nonEmptyEditor,
        currentContent: '<p>Hello world</p>',
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test group 4: post-delete auto-navigation (Bug 2 fix)
//
// Bug 2: After clicking "+" on a 1-entry day, switching to a different day
// without typing, then switching back, the blank entry is auto-deleted by
// the debounced save (handleContentUpdate schedules a save on the blank
// entry when the day is re-loaded). Without the fix, saveCurrentById calls
// setPendingEntryId(null) and leaves the editor showing stale blank content
// — even though the original real entry still exists. The "+" button stays
// permanently disabled because pendingEntryId===null.
//
// Fix: after auto-deletion, if other entries remain on the day, navigate
// to the nearest one so pendingEntryId is always a real entry ID.
// ---------------------------------------------------------------------------

type MockEntry = {
  id: number;
  title: string;
  text: string;
};

/**
 * Mirrors the post-delete navigation logic added to saveCurrentById (Bug 2 fix).
 * When entries remain: navigate to nearest (clamp index).
 * When no entries remain: reset to blank state (pendingEntryId = null).
 */
function computePostDeleteState(
  dayEntries: MockEntry[],
  deletedId: number,
  currentIndex: number,
): {
  pendingEntryId: number | null;
  currentIndex: number;
  navigated: boolean;
} {
  const updatedEntries = dayEntries.filter((e) => e.id !== deletedId);
  if (updatedEntries.length > 0) {
    const newIdx = Math.min(currentIndex, updatedEntries.length - 1);
    return { pendingEntryId: updatedEntries[newIdx].id, currentIndex: newIdx, navigated: true };
  }
  return { pendingEntryId: null, currentIndex: 0, navigated: false };
}

describe('Post-delete auto-navigation — Bug 2: day-switch leaves "+" blocked', () => {
  const entry1: MockEntry = { id: 1, title: 'Entry 1', text: '<p>Hello world</p>' };
  const blankEntry: MockEntry = { id: 2, title: '', text: '' };

  it('[before fix] pendingEntryId would be null after deleting blank entry even though entry1 remains', () => {
    // Simulates the broken state: saveCurrentById deleted blank entry (id=2)
    // but only set pendingEntryId=null, leaving entry1 stranded.
    // addDisabled = pendingEntryId === null → true — "+" permanently stuck.
    const pendingEntryId = null; // what the old code set
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId,
        editor: null,
        currentContent: '',
      }),
    ).toBe(true); // WRONG — entry1 exists and has content
  });

  it('[after fix] navigates to remaining entry1 instead of resetting to null', () => {
    // Day A: [entry1(idx=0), blankEntry(idx=1)], currentIndex=1 (showing blank entry)
    const result = computePostDeleteState([entry1, blankEntry], blankEntry.id, 1);
    expect(result.pendingEntryId).toBe(entry1.id);
    expect(result.navigated).toBe(true);
  });

  it('clamps index to last valid entry after deletion', () => {
    // blankEntry was at index 1; after deletion only index 0 remains
    const result = computePostDeleteState([entry1, blankEntry], blankEntry.id, 1);
    expect(result.currentIndex).toBe(0);
  });

  it('keeps current index when deletion does not require clamping', () => {
    // 3 entries: [e0, e1, blankEntry(idx=2)], navigate to idx=1 after delete
    const e0: MockEntry = { id: 10, title: '', text: '<p>A</p>' };
    const e1: MockEntry = { id: 11, title: '', text: '<p>B</p>' };
    const blank: MockEntry = { id: 12, title: '', text: '' };
    // currentIndex=1, delete idx=2 → updatedEntries=[e0,e1], newIdx=min(1,1)=1
    const result = computePostDeleteState([e0, e1, blank], blank.id, 1);
    expect(result.currentIndex).toBe(1);
    expect(result.pendingEntryId).toBe(e1.id);
  });

  it('sets pendingEntryId to null when no entries remain', () => {
    // Single-entry day: the only (blank) entry is deleted
    const result = computePostDeleteState([blankEntry], blankEntry.id, 0);
    expect(result.pendingEntryId).toBeNull();
    expect(result.navigated).toBe(false);
    expect(result.currentIndex).toBe(0);
  });

  it('[after fix] addDisabled is false once auto-navigation loads entry1 and TipTap updates', () => {
    // After auto-navigation: pendingEntryId=entry1.id, setContent(entry1.text) fires,
    // TipTap processes content → onUpdate → setEditorIsEmpty(false).
    const loadedEditor: MockEditor = {
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    };
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId: entry1.id,
        editor: loadedEditor,
        currentContent: entry1.text,
      }),
    ).toBe(false);
  });
});
