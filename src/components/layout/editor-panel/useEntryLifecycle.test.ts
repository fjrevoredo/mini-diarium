import { describe, it, expect } from 'vitest';
import type { Editor } from '@tiptap/core';
import { computeIsEmpty } from './useEditorEmptyCheck';
import { hasImageRefs, resolveImageRefs } from '../../../lib/image-refs';

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
