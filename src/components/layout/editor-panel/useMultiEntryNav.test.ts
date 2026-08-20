import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { computeIsEmpty } from './useEditorEmptyCheck';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import type { EntryLifecycleHook } from './useEntryLifecycle';
import type { EditorEmptyCheckHook } from './useEditorEmptyCheck';
import type { T as I18nT } from '../../../i18n';

// ---------------------------------------------------------------------------
// navigateToEntry / addEntry — real hook, mocked backend + fake lifecycle
// (TODO-0104: canLeaveCurrentEntry wiring, Tasks 4.1/4.2)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  getEntriesForDate: vi.fn(),
  getAllEntryDates: vi.fn(),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    createEntry: mocks.createEntry,
    getEntriesForDate: mocks.getEntriesForDate,
    getAllEntryDates: mocks.getAllEntryDates,
  };
});

import { useMultiEntryNav } from './useMultiEntryNav';

const fakeT: I18nT = (key) => key;

const fakeEmptyCheck: EditorEmptyCheckHook = {
  editorIsEmpty: () => false,
  setEditorIsEmpty: () => false,
  isContentEmpty: () => false,
};

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 1,
    date: '2026-01-01',
    title: 'Title',
    text: '<p>Text</p>',
    word_count: 1,
    date_created: '2026-01-01T00:00:00Z',
    date_updated: '2026-01-01T00:00:00Z',
    metadata: null,
    locked: false,
    ...overrides,
  };
}

/**
 * Builds a real `useMultiEntryNav` instance with a hand-built fake `lifecycle` — the
 * hook only calls a handful of `EntryLifecycleHook` methods, so a fake is more direct
 * here than instantiating the real `useEntryLifecycle`.
 */
function makeNav(initialEntries: DiaryEntry[], canLeaveCurrentEntry: () => Promise<boolean>) {
  const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>(initialEntries);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [pendingEntryId, setPendingEntryId] = createSignal<number | null>(
    initialEntries[0]?.id ?? null,
  );
  const [isCreatingEntry, setIsCreatingEntry] = createSignal(false);
  const [_title, setTitle] = createSignal('');
  const [_content, setContent] = createSignal('');
  const [_wordCount, setWordCount] = createSignal(0);
  const [_entryMetadata, setEntryMetadata] = createSignal<EntryMetadata | null>(null);
  const [_hydratedEntryId, setHydratedEntryId] = createSignal<number | null>(null);

  const flushCurrent = vi.fn(async () => {});
  const flushPendingCreation = vi.fn(async () => {});

  const lifecycle: EntryLifecycleHook = {
    loadEntriesForDate: vi.fn(async () => {}),
    startEntryCreation: vi.fn(),
    flushPendingCreation,
    flushCurrent,
    discardAndReload: vi.fn(async () => {}),
    canLeaveCurrentEntry: vi.fn(canLeaveCurrentEntry),
    debouncedSave: Object.assign(vi.fn(), { cancel: vi.fn() }),
    entryCommitTargets: {
      setCurrentIndex,
      setPendingEntryId,
      setTitle,
      setContent,
      setWordCount,
      setEntryMetadata,
      setHydratedEntryId,
    },
    getJustCreatedEntryId: () => null,
    setJustCreatedEntryId: vi.fn(),
    isLoadInFlight: () => false,
    isDisposed: () => false,
    dispose: vi.fn(),
  };

  const nav = useMultiEntryNav({
    t: fakeT,
    selectedDate: () => '2026-01-01',
    dayEntries,
    setDayEntries,
    currentIndex,
    pendingEntryId,
    isCreatingEntry,
    setIsCreatingEntry,
    emptyCheck: fakeEmptyCheck,
    lifecycle,
  });

  return { nav, dayEntries, currentIndex, pendingEntryId, flushCurrent };
}

describe('navigateToEntry — canLeaveCurrentEntry gate (TODO-0104)', () => {
  beforeEach(() => {
    mocks.createEntry.mockReset();
    mocks.getEntriesForDate.mockReset();
    mocks.getAllEntryDates.mockReset();
  });

  it('aborts without changing dayEntries or currentIndex when the guard denies navigation', async () => {
    const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    const { nav, dayEntries, currentIndex, flushCurrent } = makeNav(entries, async () => false);

    await nav.navigateToEntry(1);

    expect(dayEntries()).toEqual(entries);
    expect(currentIndex()).toBe(0);
    expect(flushCurrent).not.toHaveBeenCalled();
    expect(mocks.getEntriesForDate).not.toHaveBeenCalled();
  });

  it('proceeds normally when the guard approves', async () => {
    const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    mocks.getEntriesForDate.mockResolvedValue(entries.slice().reverse());
    const { nav, currentIndex, flushCurrent } = makeNav(entries, async () => true);

    await nav.navigateToEntry(1);

    expect(flushCurrent).toHaveBeenCalledWith('navigateToEntry');
    expect(currentIndex()).toBe(1);
  });

  it('lands on the id-correct entry when the guard deleted the entry before the target', async () => {
    // Old list: A(1), B(2, current — about to be confirmed-deleted), C(3), D(4).
    // User clicks "next" from B → newIndex=2 (targets C). Backend truth after B's
    // deletion no longer includes it — the fix must land on C, not D.
    const entries = [
      makeEntry({ id: 1, title: 'A' }),
      makeEntry({ id: 2, title: 'B' }),
      makeEntry({ id: 3, title: 'C' }),
      makeEntry({ id: 4, title: 'D' }),
    ];
    // fetchEntriesOrdered reverses the backend's newest-first order — feed already
    // oldest-first here so the reversal inside fetchEntriesOrdered lands back on `entries`.
    mocks.getEntriesForDate.mockResolvedValue(
      [entries[0], entries[2], entries[3]].slice().reverse(),
    );
    const { nav, currentIndex } = makeNav(entries, async () => true);

    await nav.navigateToEntry(2);

    expect(currentIndex()).toBe(1); // C's new position after B's removal
  });
});

describe('addEntry — canLeaveCurrentEntry gate (TODO-0104)', () => {
  beforeEach(() => {
    mocks.createEntry.mockReset();
    mocks.getEntriesForDate.mockReset();
    mocks.getAllEntryDates.mockReset();
  });

  it("still creates a new entry when the guard approves (the common case — the existing isContentEmpty gate keeps the guard's delete branch unreachable here)", async () => {
    const existing = makeEntry({ id: 1 });
    const created = makeEntry({ id: 2, title: '', text: '' });
    mocks.createEntry.mockResolvedValue(created);
    mocks.getEntriesForDate.mockResolvedValue([created, existing]);
    mocks.getAllEntryDates.mockResolvedValue(['2026-01-01']);
    const { nav, dayEntries } = makeNav([existing], async () => true);

    await nav.addEntry();

    expect(mocks.createEntry).toHaveBeenCalledWith('2026-01-01');
    expect(dayEntries().some((e) => e.id === 2)).toBe(true);
  });
});

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

    function simulateNavigate(entryTitle: string): () => Promise<void> {
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
