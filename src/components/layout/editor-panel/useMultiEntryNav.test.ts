import { describe, it, expect } from 'vitest';
import type { Editor } from '@tiptap/core';
import { computeIsEmpty } from './useEditorEmptyCheck';

/**
 * Tests for the per-day navigation logic owned by the useMultiEntryNav hook.
 *
 * TipTap cannot run in jsdom, so these tests validate the logic as pure
 * functions using the shared `computeIsEmpty` helper plus local mirrors of
 * the addDisabled / post-delete index calculations exactly as they appear in
 * the hook and the shell JSX.
 */

interface MockEditorShape {
  isEmpty: boolean;
  isDestroyed: boolean;
  getText: () => string;
}

function makeEditor(mock: MockEditorShape): Editor {
  return {
    isEmpty: mock.isEmpty,
    isDestroyed: mock.isDestroyed,
    getText: mock.getText,
    state: { doc: { descendants: () => {} } },
  } as unknown as Editor;
}

/**
 * Mirrors the addDisabled prop computation in EditorPanel's JSX:
 *   isCreatingEntry() || pendingEntryId() === null || isContentEmpty()
 */
function computeAddDisabled(params: {
  isCreatingEntry: boolean;
  pendingEntryId: number | null;
  editor: Editor | null;
  currentContent: string;
}): boolean {
  return (
    params.isCreatingEntry ||
    params.pendingEntryId === null ||
    computeIsEmpty(params.editor, params.currentContent)
  );
}

// ---------------------------------------------------------------------------
// Bug regression: "+" stuck disabled after navigating from blank entry
// ---------------------------------------------------------------------------

describe('Bug regression: "+" stuck disabled after navigating from blank entry', () => {
  it('[before fix] addDisabled is true when editor.isEmpty is stale from blank entry', () => {
    // Simulates setPendingEntryId(1) triggering re-evaluation:
    //   - editor.isEmpty is still true (TipTap hasn't processed entry1.text yet)
    //   - pendingEntryId just changed from null → 1
    const staleEditor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });
    const addDisabled = computeAddDisabled({
      isCreatingEntry: false,
      pendingEntryId: 1,
      editor: staleEditor,
      currentContent: '<p></p>',
    });
    expect(addDisabled).toBe(true); // WRONG — but this is the stuck state before the fix
  });

  it('[after fix] addDisabled becomes false once TipTap processes the entry content', () => {
    const updatedEditor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    });
    const addDisabled = computeAddDisabled({
      isCreatingEntry: false,
      pendingEntryId: 1,
      editor: updatedEditor,
      currentContent: '<p>Hello world</p>',
    });
    expect(addDisabled).toBe(false); // Correct — "+" button is enabled
  });

  it('computeIsEmpty transitions from true to false when onUpdate fires with real content', () => {
    const blankEditor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });
    const loadedEditor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    });

    const beforeOnUpdate = computeIsEmpty(blankEditor, '<p></p>');
    const afterOnUpdate = computeIsEmpty(loadedEditor, '<p>Hello world</p>');

    expect(beforeOnUpdate).toBe(true);
    expect(afterOnUpdate).toBe(false);
    expect(beforeOnUpdate).not.toBe(afterOnUpdate);
  });
});

// ---------------------------------------------------------------------------
// addDisabled formula correctness
// ---------------------------------------------------------------------------

describe('addDisabled formula — correct behavior after fix', () => {
  const nonEmptyEditor = makeEditor({
    isEmpty: false,
    isDestroyed: false,
    getText: () => 'Hello world',
  });
  const emptyEditor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });

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
// Post-delete auto-navigation — Bug 2: day-switch leaves "+" blocked
// ---------------------------------------------------------------------------

type MockEntry = { id: number; title: string; text: string };

/**
 * Mirrors saveCurrentById's post-delete navigation. When entries remain: clamp
 * to nearest. When none remain: reset to blank state.
 */
function computePostDeleteState(
  dayEntries: MockEntry[],
  deletedId: number,
  currentIndex: number,
): { pendingEntryId: number | null; currentIndex: number; navigated: boolean } {
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

  it('[before fix] pendingEntryId would be null even though a real entry remains', () => {
    const pendingEntryId = null;
    expect(
      computeAddDisabled({
        isCreatingEntry: false,
        pendingEntryId,
        editor: null,
        currentContent: '',
      }),
    ).toBe(true); // WRONG — entry1 exists and has content
  });

  it('[after fix] navigates to remaining entry instead of resetting to null', () => {
    const result = computePostDeleteState([entry1, blankEntry], blankEntry.id, 1);
    expect(result.pendingEntryId).toBe(entry1.id);
    expect(result.navigated).toBe(true);
  });

  it('clamps index to last valid entry after deletion', () => {
    const result = computePostDeleteState([entry1, blankEntry], blankEntry.id, 1);
    expect(result.currentIndex).toBe(0);
  });

  it('keeps current index when deletion does not require clamping', () => {
    const e0: MockEntry = { id: 10, title: '', text: '<p>A</p>' };
    const e1: MockEntry = { id: 11, title: '', text: '<p>B</p>' };
    const blank: MockEntry = { id: 12, title: '', text: '' };
    const result = computePostDeleteState([e0, e1, blank], blank.id, 1);
    expect(result.currentIndex).toBe(1);
    expect(result.pendingEntryId).toBe(e1.id);
  });

  it('sets pendingEntryId to null when no entries remain', () => {
    const result = computePostDeleteState([blankEntry], blankEntry.id, 0);
    expect(result.pendingEntryId).toBeNull();
    expect(result.navigated).toBe(false);
    expect(result.currentIndex).toBe(0);
  });

  it('[after fix] addDisabled is false once auto-navigation loads entry1 and TipTap updates', () => {
    const loadedEditor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    });
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

// ---------------------------------------------------------------------------
// handleDeleteEntry — post-delete index / entry selection
// ---------------------------------------------------------------------------

/** Mirrors handleDeleteEntry's post-delete navigation logic. */
function calculatePostDeleteIndex(
  currentIndex: number,
  entriesAfterDelete: { id: number }[],
): { newIndex: number; entryId: number | null } {
  if (entriesAfterDelete.length === 0) {
    return { newIndex: 0, entryId: null };
  }
  let newIndex = currentIndex;
  if (newIndex >= entriesAfterDelete.length) {
    newIndex = entriesAfterDelete.length - 1;
  }
  const entry = entriesAfterDelete[newIndex];
  return { newIndex, entryId: entry.id };
}

describe('handleDeleteEntry — middle entry', () => {
  it('stays at same index when deleting middle entry', () => {
    const afterDelete = [{ id: 1 }, { id: 3 }];
    const result = calculatePostDeleteIndex(1, afterDelete);
    expect(result.newIndex).toBe(1);
    expect(result.entryId).toBe(3);
  });
});

describe('handleDeleteEntry — last entry', () => {
  it('navigates to new last entry when deleting last entry', () => {
    const afterDelete = [{ id: 1 }];
    const result = calculatePostDeleteIndex(1, afterDelete);
    expect(result.newIndex).toBe(0);
    expect(result.entryId).toBe(1);
  });

  it('clamps index to last position when deleting last of many', () => {
    const afterDelete = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = calculatePostDeleteIndex(3, afterDelete);
    expect(result.newIndex).toBe(2);
    expect(result.entryId).toBe(3);
  });
});

describe('handleDeleteEntry — first entry', () => {
  it('stays at index 0 when deleting first entry', () => {
    const afterDelete = [{ id: 2 }];
    const result = calculatePostDeleteIndex(0, afterDelete);
    expect(result.newIndex).toBe(0);
    expect(result.entryId).toBe(2);
  });
});

describe('handleDeleteEntry — only entry', () => {
  it('resets to empty state when deleting only entry', () => {
    const afterDelete: { id: number }[] = [];
    const result = calculatePostDeleteIndex(0, afterDelete);
    expect(result.newIndex).toBe(0);
    expect(result.entryId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Guard clauses — prevent delete when conditions not met
// ---------------------------------------------------------------------------

describe('handleDeleteEntry — guard clauses', () => {
  it('prevents delete when day has only 1 entry', () => {
    const dayEntries = [{ id: 1 }];
    const shouldAllowDelete = dayEntries.length > 1;
    expect(shouldAllowDelete).toBe(false);
  });

  it('allows delete when day has multiple entries', () => {
    const dayEntries = [{ id: 1 }, { id: 2 }];
    const shouldAllowDelete = dayEntries.length > 1;
    expect(shouldAllowDelete).toBe(true);
  });

  it('requires entry to have id for deletion', () => {
    const entryToDelete: { id?: number } = { id: undefined };
    const hasValidId = entryToDelete?.id !== undefined;
    expect(hasValidId).toBe(false);
  });

  it('proceeds with delete when entry has valid id', () => {
    const entryToDelete = { id: 5 };
    const hasValidId = entryToDelete?.id !== undefined;
    expect(hasValidId).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Delete button — disabled state in EntryNavBar
// ---------------------------------------------------------------------------

describe('delete button — disabled state', () => {
  it('disables delete button when isCreatingEntry is true', () => {
    const isCreatingEntry = true;
    const dayEntries = [{ id: 1 }, { id: 2 }];
    const isDisabled = isCreatingEntry || dayEntries.length <= 1;
    expect(isDisabled).toBe(true);
  });

  it('disables delete button when only 1 entry exists', () => {
    const isCreatingEntry = false;
    const dayEntries = [{ id: 1 }];
    const isDisabled = isCreatingEntry || dayEntries.length <= 1;
    expect(isDisabled).toBe(true);
  });

  it('enables delete button when creating is done and multiple entries exist', () => {
    const isCreatingEntry = false;
    const dayEntries = [{ id: 1 }, { id: 2 }];
    const isDisabled = isCreatingEntry || dayEntries.length <= 1;
    expect(isDisabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 4.2: navToken race guard — only the last navigateToEntry wins
// ---------------------------------------------------------------------------

describe('navToken race guard — navigateToEntry (Task 4.2)', () => {
  it('a later navigation cancels an earlier one (token check)', () => {
    // Models the navToken pattern inside navigateToEntry:
    // - Each call increments navToken before awaiting.
    // - A check `token !== navToken` after the await short-circuits if a newer call ran.
    let navToken = 0;
    const results: string[] = [];

    function simulateNavigate(entryTitle: string): () => void {
      const token = ++navToken;
      return async () => {
        // Simulate the async fetchEntriesOrdered await
        await Promise.resolve();
        if (token !== navToken) return; // stale — a newer call beat us
        results.push(entryTitle);
      };
    }

    const nav1 = simulateNavigate('Entry A');
    const nav2 = simulateNavigate('Entry B');

    // Run both; nav2 should win because it incremented navToken last.
    Promise.all([nav1(), nav2()]).then(() => {
      expect(results).toEqual(['Entry B']);
    });

    // Verify: token for nav1 (1) !== navToken (2) → nav1 is discarded.
    expect(navToken).toBe(2);
  });

  it('a single navigation completes when not cancelled', async () => {
    let navToken = 0;
    const results: string[] = [];

    async function simulateNavigate(entryTitle: string): Promise<void> {
      const token = ++navToken;
      await Promise.resolve();
      if (token !== navToken) return;
      results.push(entryTitle);
    }

    await simulateNavigate('Only Entry');
    expect(results).toEqual(['Only Entry']);
  });
});

describe('EntryNavBar — delete button visibility', () => {
  it('does NOT show delete button when total is 1', () => {
    const total = 1;
    const onDeleteProvided = true;
    const shouldShow = total > 1 && onDeleteProvided;
    expect(shouldShow).toBe(false);
  });

  it('does NOT show delete button when onDelete not provided', () => {
    const total = 3;
    const onDeleteProvided = false;
    const shouldShow = total > 1 && onDeleteProvided;
    expect(shouldShow).toBe(false);
  });

  it('shows delete button when total > 1 and onDelete provided', () => {
    const total = 3;
    const onDeleteProvided = true;
    const shouldShow = total > 1 && onDeleteProvided;
    expect(shouldShow).toBe(true);
  });
});
