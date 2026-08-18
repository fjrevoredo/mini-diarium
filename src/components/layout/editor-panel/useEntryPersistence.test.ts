import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import type { Editor } from '@tiptap/core';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import { useEntryPersistence } from './useEntryPersistence';

/**
 * Direct tests for the write-path coordinator extracted from `useEntryLifecycle`
 * (TODO-0089 remediation). No component and no TipTap: the hook is driven with plain
 * signals and a hand-rolled editor stub, so the guards it exists to enforce — hydration
 * identity, payload-carried decisions, the delete reconcile, and the deliberate absence
 * of a disposal guard on `writeSnapshot` — are asserted at their own boundary rather
 * than inferred from `EditorPanel.integration.test.tsx`.
 */

const mocks = vi.hoisted(() => ({
  saveEntry: vi.fn(),
  deleteEntryIfEmpty: vi.fn(),
  getAllEntryDates: vi.fn(),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    saveEntry: mocks.saveEntry,
    deleteEntryIfEmpty: mocks.deleteEntryIfEmpty,
    getAllEntryDates: mocks.getAllEntryDates,
  };
});

function makeEditor(html: () => string): Editor {
  return {
    get isEmpty() {
      const h = html();
      return !h || h === '<p></p>' || h === '<p><br></p>';
    },
    isDestroyed: false,
    getHTML: () => html(),
    getText: () => html().replace(/<[^>]*>/g, ''),
    state: { doc: { descendants: () => {} } },
  } as unknown as Editor;
}

function makeEntry(id: number, text: string): DiaryEntry {
  return {
    id,
    date: '2026-07-28',
    title: '',
    text,
    word_count: 1,
    date_created: '2026-07-28T00:00:00Z',
    date_updated: '2026-07-28T00:00:00Z',
    metadata: null,
    locked: false,
  } as DiaryEntry;
}

/**
 * Builds the hook inside a reactive root with writable signals for every input, plus a
 * spy for the reconcile callback. Returns a `dispose` the caller must invoke.
 */
function setup(initial?: { entryId?: number | null; content?: string; title?: string }) {
  const [title, setTitle] = createSignal(initial?.title ?? '');
  const [content, setContent] = createSignal(initial?.content ?? '<p>hello</p>');
  const [pendingEntryId, setPendingEntryId] = createSignal<number | null>(initial?.entryId ?? 1);
  const [entryMetadata, setEntryMetadata] = createSignal<EntryMetadata | null>(null);
  const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>([]);
  const onEmptyEntryDeleted =
    vi.fn<(remaining: DiaryEntry[], isStale: () => boolean) => Promise<void>>();
  onEmptyEntryDeleted.mockResolvedValue(undefined);

  let hook!: ReturnType<typeof useEntryPersistence>;
  let disposeRoot!: () => void;
  createRoot((d) => {
    disposeRoot = d;
    hook = useEntryPersistence({
      editorInstance: () => makeEditor(content),
      title,
      content,
      pendingEntryId,
      entryMetadata,
      dayEntries,
      setDayEntries,
      onEmptyEntryDeleted,
    });
  });

  return {
    hook,
    onEmptyEntryDeleted,
    setTitle,
    setContent,
    setPendingEntryId,
    setEntryMetadata,
    dayEntries,
    setDayEntries,
    dispose: disposeRoot,
  };
}

describe('useEntryPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveEntry.mockResolvedValue(undefined);
    mocks.deleteEntryIfEmpty.mockResolvedValue(true);
    mocks.getAllEntryDates.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hydration identity guard', () => {
    it('returns no snapshot when the editor is hydrated for a different entry', () => {
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(8); // the load that supplied the document was for entry 8
      expect(s.hook.captureCurrentSnapshot()).toBeNull();
      s.dispose();
    });

    it('returns no snapshot when nothing is hydrated yet', () => {
      const s = setup({ entryId: 7 });
      expect(s.hook.captureCurrentSnapshot()).toBeNull();
      s.dispose();
    });

    it('returns no snapshot when pendingEntryId is null — the invariant a post-restore discard relies on', () => {
      // Task 4.2: after a whole-journal restore, the editor's in-memory entry state must be
      // discarded rather than flushed, or pre-restore content would be written back over the
      // restored entry. `clearEntryFromEditor` sets pendingEntryId to null before the reload;
      // this is what makes the flushCurrent call inside the subsequent loadEntriesForDate a
      // guaranteed no-op instead of a stale write.
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(7);
      s.setPendingEntryId(null);
      expect(s.hook.captureCurrentSnapshot()).toBeNull();
      s.dispose();
    });

    it('snapshots id, title, body, and metadata together once hydration agrees', () => {
      const meta: EntryMetadata = { font_family: 'Inter' } as EntryMetadata;
      const s = setup({ entryId: 7, title: 'A title', content: '<p>body</p>' });
      s.setEntryMetadata(meta);
      s.hook.setHydratedEntryId(7);
      expect(s.hook.captureCurrentSnapshot()).toEqual({
        entryId: 7,
        title: 'A title',
        content: '<p>body</p>',
        isEmpty: false,
        metadata: meta,
      });
      s.dispose();
    });

    it('refuses the write when hydration disagrees, even with a hand-built payload', async () => {
      vi.useFakeTimers();
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(8);
      // Reaching the write path directly is only possible through the debounce, which is
      // what the "saveCurrentById is private" rule leaves callers with.
      s.hook.debouncedSave(7, 'A title', '<p>body</p>', false, null);
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.saveEntry).not.toHaveBeenCalled();
      expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
      s.dispose();
    });
  });

  describe('the decision travels with the payload', () => {
    it('saves using the queued isEmpty even after the live document went blank', async () => {
      vi.useFakeTimers();
      const s = setup({ entryId: 7, content: '<p>real content</p>' });
      s.hook.setHydratedEntryId(7);
      s.hook.debouncedSave(7, '', '<p>real content</p>', false, null);
      // The exact race TODO-0089 fixed: by the time the 500 ms timer fires the editor has
      // been reset. A live re-read here would turn this save into a delete.
      s.setContent('<p></p>');
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
      expect(mocks.saveEntry).toHaveBeenCalledWith(7, '', '<p>real content</p>', null);
      s.dispose();
    });

    it('writes the metadata carried by the payload, not a live re-read', async () => {
      vi.useFakeTimers();
      const queued: EntryMetadata = { font_family: 'Queued' } as EntryMetadata;
      const later: EntryMetadata = { font_family: 'Later' } as EntryMetadata;
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(7);
      s.setEntryMetadata(queued);
      s.hook.debouncedSave(7, '', '<p>body</p>', false, queued);
      s.setEntryMetadata(later);
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.saveEntry).toHaveBeenCalledWith(7, '', '<p>body</p>', queued);
      s.dispose();
    });

    it('deletes only when the payload says blank body AND blank title', async () => {
      vi.useFakeTimers();
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(7);
      // A blank body kept alive by a title is a save, not a delete.
      s.hook.debouncedSave(7, 'Kept by title', '<p></p>', true, null);
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
      expect(mocks.saveEntry).toHaveBeenCalledWith(7, 'Kept by title', '<p></p>', null);
      s.dispose();
    });
  });

  describe('delete branch reconcile', () => {
    it('hands the remaining entries to the reconcile callback', async () => {
      vi.useFakeTimers();
      const s = setup({ entryId: 7 });
      s.setDayEntries([makeEntry(7, '<p></p>'), makeEntry(9, '<p>kept</p>')]);
      s.hook.setHydratedEntryId(7);
      s.hook.debouncedSave(7, '', '<p></p>', true, null);
      await vi.advanceTimersByTimeAsync(600);

      expect(mocks.deleteEntryIfEmpty).toHaveBeenCalledWith(7, '', '<p></p>');
      // The deleted entry is dropped from the day's list by the coordinator...
      expect(s.dayEntries().map((e) => e.id)).toEqual([9]);
      // ...and only "which entry shows now" is delegated.
      expect(s.onEmptyEntryDeleted).toHaveBeenCalledTimes(1);
      const [remaining] = s.onEmptyEntryDeleted.mock.calls[0];
      expect(remaining.map((e) => e.id)).toEqual([9]);
      s.dispose();
    });

    it('does not reconcile when the backend refuses the delete', async () => {
      vi.useFakeTimers();
      mocks.deleteEntryIfEmpty.mockResolvedValue(false);
      const s = setup({ entryId: 7 });
      s.setDayEntries([makeEntry(7, '<p>actually not blank</p>')]);
      s.hook.setHydratedEntryId(7);
      s.hook.debouncedSave(7, '', '<p></p>', true, null);
      await vi.advanceTimersByTimeAsync(600);

      expect(s.onEmptyEntryDeleted).not.toHaveBeenCalled();
      expect(s.dayEntries().map((e) => e.id)).toEqual([7]);
      s.dispose();
    });

    it('reports staleness to the callback after disposal', async () => {
      vi.useFakeTimers();
      const s = setup({ entryId: 7 });
      s.setDayEntries([makeEntry(7, '<p></p>'), makeEntry(9, '<p>kept</p>')]);
      s.hook.setHydratedEntryId(7);
      s.hook.debouncedSave(7, '', '<p></p>', true, null);
      await vi.advanceTimersByTimeAsync(600);
      // The callback awaits an image resolve of its own, so the guard it commits behind
      // has to keep reporting the coordinator's current state — not a captured boolean.
      const isStale = s.onEmptyEntryDeleted.mock.calls[0][1];
      expect(isStale()).toBe(false);
      s.hook.markDisposed();
      expect(isStale()).toBe(true);
      s.dispose();
    });
  });

  describe('teardown', () => {
    it('writeSnapshot still writes after markDisposed — teardown must not drop content', async () => {
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(7);
      const snap = s.hook.captureCurrentSnapshot();
      expect(snap).not.toBeNull();
      s.hook.markDisposed();
      await s.hook.writeSnapshot(snap!, 'dispose');
      expect(mocks.saveEntry).toHaveBeenCalledWith(7, '', '<p>hello</p>', null);
      s.dispose();
    });

    it('flushCurrent is a no-op after markDisposed (the UI-touching path is guarded)', async () => {
      const s = setup({ entryId: 7 });
      s.hook.setHydratedEntryId(7);
      s.hook.markDisposed();
      await s.hook.flushCurrent('afterDispose');
      expect(mocks.saveEntry).not.toHaveBeenCalled();
      s.dispose();
    });

    it('writeSnapshot routes a blank-title blank-body snapshot to the delete command', async () => {
      const s = setup({ entryId: 7, content: '<p></p>' });
      s.hook.setHydratedEntryId(7);
      const snap = s.hook.captureCurrentSnapshot();
      await s.hook.writeSnapshot(snap!, 'dispose');
      expect(mocks.deleteEntryIfEmpty).toHaveBeenCalledWith(7, '', '<p></p>');
      expect(mocks.saveEntry).not.toHaveBeenCalled();
      s.dispose();
    });
  });

  describe('flushCurrent', () => {
    it('cancels a queued debounce so the flush is the only write', async () => {
      vi.useFakeTimers();
      const s = setup({ entryId: 7, content: '<p>body</p>' });
      s.hook.setHydratedEntryId(7);
      s.hook.debouncedSave(7, 'stale title', '<p>stale</p>', false, null);
      await s.hook.flushCurrent('navigateToEntry');
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.saveEntry).toHaveBeenCalledTimes(1);
      expect(mocks.saveEntry).toHaveBeenCalledWith(7, '', '<p>body</p>', null);
      s.dispose();
    });

    it('writes nothing once pendingEntryId has been cleared (Task 4.2 discard-and-reload)', async () => {
      const s = setup({ entryId: 7, content: '<p>pre-restore body</p>' });
      s.hook.setHydratedEntryId(7);
      s.setPendingEntryId(null); // what clearEntryFromEditor does, before any reload
      await s.hook.flushCurrent('loadEntriesForDate');
      expect(mocks.saveEntry).not.toHaveBeenCalled();
      expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
      s.dispose();
    });
  });
});
