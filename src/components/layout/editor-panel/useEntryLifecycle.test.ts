import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { computeIsEmpty } from './useEditorEmptyCheck';
import { hasImageRefs, resolveImageRefs } from '../../../lib/image-refs';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import type { EditorEmptyCheckHook } from './useEditorEmptyCheck';

// ---------------------------------------------------------------------------
// canLeaveCurrentEntry (TODO-0104) — real hook, mocked backend + confirm dialog
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
  entryHasContent: vi.fn(),
  confirmInApp: vi.fn(),
  getAllEntryDates: vi.fn(),
  getEntriesForDate: vi.fn(),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    createEntry: mocks.createEntry,
    deleteEntry: mocks.deleteEntry,
    entryHasContent: mocks.entryHasContent,
    getAllEntryDates: mocks.getAllEntryDates,
    getEntriesForDate: mocks.getEntriesForDate,
  };
});

vi.mock('../../../state/confirm-dialog', async () => {
  const actual = await vi.importActual<typeof import('../../../state/confirm-dialog')>(
    '../../../state/confirm-dialog',
  );
  return { ...actual, confirmInApp: mocks.confirmInApp };
});

import { useEntryLifecycle, type UseEntryLifecycleOptions } from './useEntryLifecycle';
import type { T as I18nT } from '../../../i18n';

const fakeT: I18nT = (key) => key;

const fakeEmptyCheck: EditorEmptyCheckHook = {
  editorIsEmpty: () => true,
  setEditorIsEmpty: () => true,
  isContentEmpty: () => true,
};

/**
 * Builds a real `useEntryLifecycle` instance backed by plain SolidJS signals, so
 * `canLeaveCurrentEntry` exercises the actual hook rather than a mirrored function.
 * `editorInstance` stays `null` throughout — `captureCurrentSnapshot` falls back to the
 * `content` signal, computeIsEmpty(null, content) === !content.trim().
 */
function makeLifecycle(initial: { title?: string; content?: string; pendingEntryId?: number }) {
  const [title, setTitle] = createSignal(initial.title ?? '');
  const [content, setContent] = createSignal(initial.content ?? '');
  const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [pendingEntryId, setPendingEntryId] = createSignal<number | null>(
    initial.pendingEntryId ?? null,
  );
  const [isCreatingEntry, setIsCreatingEntry] = createSignal(false);
  const [entryMetadata, setEntryMetadata] = createSignal<EntryMetadata | null>(null);

  const opts: UseEntryLifecycleOptions = {
    t: fakeT,
    selectedDate: () => '2026-01-01',
    editorInstance: () => null,
    title,
    setTitle,
    content,
    setContent,
    setWordCount: () => 0,
    dayEntries,
    setDayEntries,
    currentIndex,
    setCurrentIndex,
    pendingEntryId,
    setPendingEntryId,
    isCreatingEntry,
    setIsCreatingEntry,
    emptyCheck: fakeEmptyCheck,
    entryMetadata,
    setEntryMetadata,
  };

  const lifecycle = useEntryLifecycle(opts);
  // Satisfy captureCurrentSnapshot's hydration-identity guard directly — these tests
  // exercise canLeaveCurrentEntry in isolation, not the load path that normally sets it.
  if (initial.pendingEntryId !== undefined) {
    lifecycle.entryCommitTargets.setHydratedEntryId(initial.pendingEntryId);
  }
  return { lifecycle, setPendingEntryId, dayEntries, title, content, currentIndex };
}

describe('canLeaveCurrentEntry (TODO-0104)', () => {
  beforeEach(() => {
    mocks.createEntry.mockReset();
    mocks.deleteEntry.mockReset().mockResolvedValue(undefined);
    mocks.entryHasContent.mockReset();
    mocks.confirmInApp.mockReset();
    mocks.getAllEntryDates.mockReset().mockResolvedValue([]);
    mocks.getEntriesForDate.mockReset();
  });

  it('canLeaveCurrentEntry allows navigation when there is no pending entry', async () => {
    const { lifecycle } = makeLifecycle({});
    const result = await lifecycle.canLeaveCurrentEntry('test');
    expect(result).toBe(true);
    expect(mocks.entryHasContent).not.toHaveBeenCalled();
    expect(mocks.confirmInApp).not.toHaveBeenCalled();
  });

  it('canLeaveCurrentEntry allows navigation when the edit is an ordinary save (not a delete)', async () => {
    const { lifecycle } = makeLifecycle({
      pendingEntryId: 1,
      title: 'Real title',
      content: '<p>Real content</p>',
    });
    const result = await lifecycle.canLeaveCurrentEntry('test');
    expect(result).toBe(true);
    expect(mocks.entryHasContent).not.toHaveBeenCalled();
    expect(mocks.confirmInApp).not.toHaveBeenCalled();
  });

  it('canLeaveCurrentEntry allows navigation without a dialog when the on-disk entry was already blank', async () => {
    mocks.entryHasContent.mockResolvedValue(false);
    const { lifecycle } = makeLifecycle({ pendingEntryId: 2, title: '', content: '' });
    const result = await lifecycle.canLeaveCurrentEntry('test');
    expect(result).toBe(true);
    expect(mocks.entryHasContent).toHaveBeenCalledWith(2);
    expect(mocks.confirmInApp).not.toHaveBeenCalled();
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
  });

  it("canLeaveCurrentEntry shows the confirm dialog and, on cancel, restores the entry's real content from disk while still denying navigation", async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirmInApp.mockResolvedValue(false);
    mocks.getEntriesForDate.mockResolvedValue([
      {
        id: 3,
        date: '2026-01-01',
        title: 'Real title',
        text: '<p>Real content</p>',
        word_count: 2,
        date_created: '2026-01-01T00:00:00Z',
        date_updated: '2026-01-01T00:00:00Z',
        metadata: null,
        locked: false,
      },
    ]);
    const { lifecycle, title, content, currentIndex } = makeLifecycle({
      pendingEntryId: 3,
      title: '',
      content: '',
    });

    const result = await lifecycle.canLeaveCurrentEntry('test');

    expect(result).toBe(false);
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-01-01');
    expect(title()).toBe('Real title');
    expect(content()).toBe('<p>Real content</p>');
    expect(currentIndex()).toBe(0);
  });

  it("canLeaveCurrentEntry restores the correct entry on cancel when it is not the day's newest entry", async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirmInApp.mockResolvedValue(false);
    // Backend returns newest-first: id 10 is the day's newest, id 3 is older.
    // fetchEntriesOrdered reverses this to [id 3 (idx 0), id 10 (idx 1)].
    mocks.getEntriesForDate.mockResolvedValue([
      {
        id: 10,
        date: '2026-01-01',
        title: 'Newest',
        text: '<p>Newest content</p>',
        word_count: 2,
        date_created: '2026-01-01T00:00:00Z',
        date_updated: '2026-01-01T00:00:00Z',
        metadata: null,
        locked: false,
      },
      {
        id: 3,
        date: '2026-01-01',
        title: 'Erased entry real title',
        text: '<p>Erased entry real content</p>',
        word_count: 3,
        date_created: '2026-01-01T00:00:00Z',
        date_updated: '2026-01-01T00:00:00Z',
        metadata: null,
        locked: false,
      },
    ]);
    // The user was editing entry 3 (not the day's newest) and erased it.
    const { lifecycle, title, content, currentIndex } = makeLifecycle({
      pendingEntryId: 3,
      title: '',
      content: '',
    });

    const result = await lifecycle.canLeaveCurrentEntry('test');

    expect(result).toBe(false);
    // Restored entry 3's own content (idx 0 after reversal) — not entry 10's, even
    // though entry 10 is the day's newest and would be loadEntriesForDate's own default.
    expect(title()).toBe('Erased entry real title');
    expect(content()).toBe('<p>Erased entry real content</p>');
    expect(currentIndex()).toBe(0);
  });

  it('canLeaveCurrentEntry clears the editor on cancel if the entry no longer exists on disk', async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirmInApp.mockResolvedValue(false);
    mocks.getEntriesForDate.mockResolvedValue([]); // entry 3 is gone by the time of the reload
    const { lifecycle, title, content } = makeLifecycle({
      pendingEntryId: 3,
      title: '',
      content: '',
    });

    const result = await lifecycle.canLeaveCurrentEntry('test');

    expect(result).toBe(false);
    // title()/content() are already '' before this call (they were blank — that's what
    // triggered the dialog), so asserting them alone would pass identically whether or
    // not a restore was ever attempted. Assert the restore fetch actually ran — that is
    // the only way this test can fail against the pre-fix implementation, which never
    // calls getEntriesForDate from the cancel branch at all.
    expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-01-01');
    expect(title()).toBe('');
    expect(content()).toBe('');
  });

  it('canLeaveCurrentEntry attempts the restore and still denies navigation if the restore fetch itself fails', async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirmInApp.mockResolvedValue(false);
    mocks.getEntriesForDate.mockRejectedValue(new Error('network error'));
    const { lifecycle, title, content } = makeLifecycle({
      pendingEntryId: 9,
      title: '',
      content: '',
    });

    const result = await lifecycle.canLeaveCurrentEntry('test');

    expect(result).toBe(false);
    // Same reasoning as the previous test: assert the restore was actually attempted
    // (this is what makes the test meaningful pre- vs. post-fix), not just that nothing
    // crashed — a no-op cancel branch would also trivially satisfy the assertions below.
    expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-01-01');
    // The restore itself failed — this degrades to the pre-fix visual state (blank, but
    // nothing was deleted) rather than throwing past the caller. Deliberate, narrow
    // fallback: this failure is rare, and the entry is still safe on disk regardless —
    // deny only blocks navigation, it deletes nothing.
    expect(title()).toBe('');
    expect(content()).toBe('');
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
  });

  it('canLeaveCurrentEntry shows the confirm dialog, hard-deletes and clears the editor on confirm, then allows navigation', async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirmInApp.mockResolvedValue(true);
    mocks.getAllEntryDates.mockResolvedValue(['2026-01-01']);
    const { lifecycle } = makeLifecycle({ pendingEntryId: 4, title: '', content: '' });
    const result = await lifecycle.canLeaveCurrentEntry('test');
    expect(result).toBe(true);
    expect(mocks.deleteEntry).toHaveBeenCalledWith(4);
    // Regression: a confirmed hard delete must refresh entryDates the same way the
    // soft-delete path does, or the calendar's "has entry" indicator goes stale for
    // this date (caught by e2e/specs/backup-restore.spec.ts).
    expect(mocks.getAllEntryDates).toHaveBeenCalled();
  });

  // Regression: a real E2E race (multi-entry.spec.ts Scenario C) hit this — an
  // independent debounced autosave can auto-delete the same blank entry via
  // deleteEntryIfEmpty before this guard's own entryHasContent() call runs, so the
  // entry is legitimately gone by the time the guard checks it.
  it('canLeaveCurrentEntry allows navigation when entryHasContent rejects with "Entry not found" (entry already deleted by a race)', async () => {
    mocks.entryHasContent.mockRejectedValue('Entry not found');
    const { lifecycle } = makeLifecycle({ pendingEntryId: 5, title: '', content: '' });
    const result = await lifecycle.canLeaveCurrentEntry('test');
    expect(result).toBe(true);
    expect(mocks.confirmInApp).not.toHaveBeenCalled();
  });

  it('canLeaveCurrentEntry denies navigation when entryHasContent rejects with an unrelated error', async () => {
    mocks.entryHasContent.mockRejectedValue(new Error('network error'));
    const { lifecycle } = makeLifecycle({ pendingEntryId: 6, title: '', content: '' });
    const result = await lifecycle.canLeaveCurrentEntry('test');
    expect(result).toBe(false);
  });

  // Regression: a same-day search-result click races two independent callers of this
  // function for one user action — SearchResults.tsx's own guarded requestDateAndViewChange,
  // and EditorPanel's same-day deep-link effect (fired synchronously by the
  // `setSelectedEntryId` write that click makes) calling `navigateToEntry`, which calls this
  // guard too. Before coalescing, the second caller's `confirmInApp()` silently overwrote the
  // first's `pendingResolve` (see confirm-dialog.ts), permanently hanging the first caller's
  // promise — `navigateToEntry` never continued, so the search click's intended entry switch
  // silently never happened even though the delete itself was confirmed and completed.
  it('canLeaveCurrentEntry coalesces two concurrent callers into a single check-and-confirm cycle', async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    let resolveConfirm!: (value: boolean) => void;
    mocks.confirmInApp.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    mocks.getAllEntryDates.mockResolvedValue(['2026-01-01']);
    const { lifecycle } = makeLifecycle({ pendingEntryId: 7, title: '', content: '' });

    // Two callers racing for the same click, neither awaited before the other starts.
    const first = lifecycle.canLeaveCurrentEntry('navigateToEntry');
    const second = lifecycle.canLeaveCurrentEntry('navigationGuard');

    // Let entryHasContent's own mocked promise settle before the dialog appears.
    await vi.waitFor(() => expect(mocks.confirmInApp).toHaveBeenCalledTimes(1));
    // The second caller must not have started its own independent check-and-confirm cycle.
    expect(mocks.entryHasContent).toHaveBeenCalledTimes(1);

    resolveConfirm(true);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    // Both callers see the same outcome, and the delete itself only ran once.
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(mocks.deleteEntry).toHaveBeenCalledTimes(1);
    expect(mocks.confirmInApp).toHaveBeenCalledTimes(1);
  });

  // Regression guard for the coalescing fix itself: it must only merge genuinely
  // concurrent callers, not silently reuse a stale result for an unrelated later call —
  // that would deny/allow navigation based on a snapshot of a different entry entirely.
  it('canLeaveCurrentEntry starts a fresh check for a later, non-concurrent call rather than reusing a coalesced result', async () => {
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirmInApp.mockResolvedValue(true);
    mocks.getAllEntryDates.mockResolvedValue(['2026-01-01']);
    const { lifecycle } = makeLifecycle({ pendingEntryId: 8, title: '', content: '' });

    // First check fully resolves (deletes entry 8) before the second call is made at all.
    const first = await lifecycle.canLeaveCurrentEntry('navigateToEntry');
    expect(first).toBe(true);
    expect(mocks.entryHasContent).toHaveBeenCalledTimes(1);

    // No pending entry remains after the delete above, so this second call is allowed
    // without even reaching entryHasContent — the coalescing must not have left the
    // in-flight slot permanently occupied by the first call's already-settled promise.
    const second = await lifecycle.canLeaveCurrentEntry('navigationGuard');
    expect(second).toBe(true);
    expect(mocks.entryHasContent).toHaveBeenCalledTimes(1);
    expect(mocks.confirmInApp).toHaveBeenCalledTimes(1);
  });
});

/**
 * Tests for the save/create/delete branching logic owned by the
 * useEntryLifecycle hook.
 *
 * TipTap cannot run in jsdom, so these tests validate the branching
 * patterns as pure functions and the shared emptiness check via the
 * `computeIsEmpty` helper exported by useEditorEmptyCheck.
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

// ---------------------------------------------------------------------------
// saveCurrentById — branch selection (delete vs save)
// ---------------------------------------------------------------------------

describe('saveCurrentById — branch selection', () => {
  it('routes to delete branch when editor is empty and title is blank', () => {
    const editor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });
    const currentTitle = '';
    const empty = computeIsEmpty(editor, '<p></p>');
    expect(!currentTitle.trim() && empty).toBe(true);
  });

  it('routes to save branch when title is non-empty even if editor is empty', () => {
    const editor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });
    const currentTitle = 'My title';
    const empty = computeIsEmpty(editor, '<p></p>');
    expect(!currentTitle.trim() && empty).toBe(false);
  });

  it('routes to save branch when editor has content even if title is blank', () => {
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Some text',
    });
    const currentTitle = '';
    const empty = computeIsEmpty(editor, '<p>Some text</p>');
    expect(!currentTitle.trim() && empty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleContentUpdate gate — Bug 1: phantom createEntry on empty-day navigation
//
// When loading an empty day, setContent('') propagates through DiaryEditor's
// createEffect → editor.commands.setContent('') → TipTap fires onUpdate with
// empty HTML. startEntryCreation must NOT be called in that case.
// ---------------------------------------------------------------------------

/** Mirrors the shouldCreate gate in EditorPanel's handleContentUpdate. */
function shouldCreateOnContentUpdate(
  editor: Editor | null,
  content: string,
  pendingEntryId: number | null,
  isCreatingEntry: boolean,
): boolean {
  if (pendingEntryId !== null) return false;
  const isEmpty = computeIsEmpty(editor, content);
  return !isEmpty && !isCreatingEntry;
}

describe('handleContentUpdate — shouldCreate gate (Bug 1: phantom create)', () => {
  it('does NOT create when editor is empty (programmatic setContent from load)', () => {
    const editor = makeEditor({ isEmpty: true, isDestroyed: false, getText: () => '' });
    expect(shouldCreateOnContentUpdate(editor, '', null, false)).toBe(false);
  });

  it('does NOT create when editor contains only whitespace', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => '   ' });
    expect(shouldCreateOnContentUpdate(editor, '<p>   </p>', null, false)).toBe(false);
  });

  it('DOES create when editor has real content and no pending entry', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => 'Hello' });
    expect(shouldCreateOnContentUpdate(editor, '<p>Hello</p>', null, false)).toBe(true);
  });

  it('does NOT create when entry already exists (pendingEntryId is set)', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => 'Hello' });
    expect(shouldCreateOnContentUpdate(editor, '<p>Hello</p>', 42, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleContentUpdate gate — Bug 3: concurrent createEntry on fast typing
// ---------------------------------------------------------------------------

describe('handleContentUpdate — isCreatingEntry guard (Bug 3: race)', () => {
  it('does NOT create when isCreatingEntry is true', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => 'He' });
    expect(shouldCreateOnContentUpdate(editor, '<p>He</p>', null, true)).toBe(false);
  });

  it('DOES create on the first keystroke (isCreatingEntry starts false)', () => {
    const editor = makeEditor({ isEmpty: false, isDestroyed: false, getText: () => 'H' });
    expect(shouldCreateOnContentUpdate(editor, '<p>H</p>', null, false)).toBe(true);
  });

  it('does NOT create once flag is set, even with real content', () => {
    const editor = makeEditor({
      isEmpty: false,
      isDestroyed: false,
      getText: () => 'Hello world',
    });
    expect(shouldCreateOnContentUpdate(editor, '<p>Hello world</p>', null, true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bug 2 regression — stale deleted-entry id
//
// After deleteEntryIfEmpty succeeds, pendingEntryId must be reset to null (or
// navigated to a remaining entry) and the deleted entry removed from
// dayEntries. If not, subsequent keystrokes call saveEntry(deletedId, …) which
// silently updates 0 rows.
// ---------------------------------------------------------------------------

/** Mirrors the post-delete state update inside saveCurrentById. */
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
  it('resets pendingEntryId to null after delete (no entries remain)', () => {
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
    const entries = [{ id: 5 }, { id: 6 }];
    const result = applyDeletedEntryState(entries, 99);
    expect(result.dayEntries).toEqual(entries);
  });
});

// ---------------------------------------------------------------------------
// justCreatedEntryId guard — suppresses auto-delete debounce for a freshly
// created blank entry.
//
// Race: addEntry() calls debouncedSave.cancel() synchronously, but DiaryEditor's
// createEffect runs as a SolidJS microtask at the next await inside addEntry().
// onSetContent(isEmpty=true) then re-queues a fresh debounce that was never
// cancelled, deleting the just-created entry before the user types.
//
// Fix: addEntry() sets justCreatedEntryId = newEntry.id. The onSetContent
// callback skips the debounce when id === justCreatedEntryId. handleContentUpdate
// and handleTitleInput clear the ref on first real keystroke.
// ---------------------------------------------------------------------------

/** Mirrors the guard in the onSetContent callback wired by the shell. */
function shouldQueueAutoDeleteDebounce(
  id: number | null,
  justCreatedEntryId: number | null,
): boolean {
  return id !== null && id !== justCreatedEntryId;
}

describe('justCreatedEntryId guard — onSetContent skips auto-delete debounce', () => {
  it('suppresses debounce immediately after entry creation (id === justCreatedEntryId)', () => {
    expect(shouldQueueAutoDeleteDebounce(42, 42)).toBe(false);
  });

  it('allows debounce for a blank entry loaded from DB (justCreatedEntryId is null)', () => {
    expect(shouldQueueAutoDeleteDebounce(42, null)).toBe(true);
  });

  it('allows debounce when a different (newer) entry was just created', () => {
    expect(shouldQueueAutoDeleteDebounce(42, 43)).toBe(true);
  });

  it('never queues debounce when no entry is active (id is null)', () => {
    expect(shouldQueueAutoDeleteDebounce(null, null)).toBe(false);
    expect(shouldQueueAutoDeleteDebounce(null, 42)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Task 4.3 guard: legacy data-URL entries must not trigger getEntryImages
  // ---------------------------------------------------------------------------

  it('hasImageRefs returns false for a legacy data-URL entry (no getEntryImages call)', () => {
    // An entry that still embeds images as data: URLs (before migration) must not
    // be treated as having image-id:// refs. The hasImageRefs guard prevents the
    // getEntryImages IPC call for such entries.
    const legacyText = '<p>Journal</p><img src="data:image/jpeg;base64,/9j/AAAA" alt="">';
    expect(hasImageRefs(legacyText)).toBe(false);
    // If hasImageRefs returns false, the code path that calls getEntryImages is skipped.
    // Content is passed to setContent verbatim — identical to the original HTML.
  });

  it('hasImageRefs returns true only for entries with image-id:// refs', () => {
    expect(hasImageRefs('<p>text</p><img src="image-id://42" alt="">')).toBe(true);
    expect(hasImageRefs('<p>no images</p>')).toBe(false);
    expect(hasImageRefs('')).toBe(false);
    expect(hasImageRefs('<p>See image-id://42 later</p>')).toBe(false);
    expect(hasImageRefs('<a href="image-id://42">not an image ref</a>')).toBe(false);
  });

  it('resolveImageRefs substitutes image-id:// refs with data URLs', () => {
    const html = '<p><img src="image-id://1" alt=""></p>';
    const images = [{ id: 1, mime_type: 'image/png', data_base64: 'abc123' }];
    const resolved = resolveImageRefs(html, images);
    expect(resolved).toContain('data:image/png;base64,abc123');
    expect(resolved).not.toContain('image-id://');
  });

  it('resolveImageRefs does not partially match image IDs (1 vs 10)', () => {
    const html = '<p><img src="image-id://1" alt=""><img src="image-id://10" alt=""></p>';
    const images = [{ id: 1, mime_type: 'image/png', data_base64: 'AAA' }];
    const resolved = resolveImageRefs(html, images);
    // ID 1 replaced, ID 10 unchanged (no image for id=10 provided)
    expect(resolved).toContain('data:image/png;base64,AAA');
    expect(resolved).toContain('image-id://10');
  });

  it('allows debounce after first keystroke clears justCreatedEntryId', () => {
    const afterFirstKeystroke: number | null = null;
    expect(shouldQueueAutoDeleteDebounce(42, afterFirstKeystroke)).toBe(true);
  });
});
