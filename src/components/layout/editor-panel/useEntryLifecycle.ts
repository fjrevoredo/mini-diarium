import { batch, createSignal, untrack, type Accessor, type Setter } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { createEntry } from '../../../lib/tauri';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import { registerCleanupCallback } from '../../../state/entries';
import { selectedEntryId, setSelectedEntryId } from '../../../state/ui';
import { createLogger } from '../../../lib/logger';
import { computeIsEmpty, type EditorEmptyCheckHook } from './useEditorEmptyCheck';
import { fetchEntriesOrdered } from './useMultiEntryNav';
import { useEntryPersistence, type DebouncedSaveFn } from './useEntryPersistence';
import {
  clearEntryFromEditor,
  commitEntryToEditor,
  resolveEntryHtml,
  type EntryCommitTargets,
} from './entryHydration';

const log = createLogger('Editor');

export interface UseEntryLifecycleOptions {
  selectedDate: Accessor<string>;
  editorInstance: Accessor<Editor | null>;
  title: Accessor<string>;
  setTitle: Setter<string>;
  content: Accessor<string>;
  setContent: Setter<string>;
  setWordCount: Setter<number>;
  dayEntries: Accessor<DiaryEntry[]>;
  setDayEntries: Setter<DiaryEntry[]>;
  currentIndex: Accessor<number>;
  setCurrentIndex: Setter<number>;
  pendingEntryId: Accessor<number | null>;
  setPendingEntryId: Setter<number | null>;
  isCreatingEntry: Accessor<boolean>;
  setIsCreatingEntry: Setter<boolean>;
  emptyCheck: EditorEmptyCheckHook;
  entryMetadata: Accessor<EntryMetadata | null>;
  setEntryMetadata: Setter<EntryMetadata | null>;
}

export interface EntryLifecycleHook {
  loadEntriesForDate: (date: string) => Promise<void>;
  startEntryCreation: (reason: string) => void;
  /**
   * Awaits and settles (save-or-delete) an in-flight createEntry() call without touching
   * pendingEntryId/dayEntries/currentIndex. No-op if no creation is in flight. Must be
   * called before any navigation-away path proceeds (dispose, date switch, entry switch,
   * lock) — otherwise the in-flight entry's typed content is lost. See TODO-0089.
   */
  flushPendingCreation: () => Promise<void>;
  /** See `EntryPersistenceHook.flushCurrent` — the only public write entry point. */
  flushCurrent: (path: string) => Promise<void>;
  debouncedSave: DebouncedSaveFn;
  /** Setters that must be written together whenever the displayed entry changes. */
  entryCommitTargets: EntryCommitTargets;
  /**
   * Guards the onSetContent(isEmpty=true) auto-delete debounce for a freshly
   * created entry. See `EditorPanel.tsx` history for the race this prevents.
   */
  getJustCreatedEntryId: () => number | null;
  setJustCreatedEntryId: (id: number | null) => void;
  /** Reactive: true while a loadEntriesForDate() is in flight. */
  isLoadInFlight: Accessor<boolean>;
  isDisposed: () => boolean;
  dispose: () => void;
}

/**
 * Orchestrates loading, creation, and teardown for the entry the editor is showing.
 *
 * The write path — snapshot capture, the `hydratedEntryId` guard, the debounce, and the
 * save-vs-delete decision — lives in `useEntryPersistence`, which this hook drives and
 * nothing else may reach.
 */
export function useEntryLifecycle(opts: UseEntryLifecycleOptions): EntryLifecycleHook {
  let loadRequestId = 0;
  let pendingCreationPromise: Promise<DiaryEntry> | null = null;
  let justCreatedEntryId: number | null = null;
  /**
   * A keystroke that arrived while a load was in flight. The creation it asked for is
   * re-evaluated once the load settles rather than acted on immediately. See TODO-0089.
   */
  let queuedCreationReason: string | null = null;

  // Starts true: the mount-time load effect always runs, and the auto-focus effect in
  // EditorPanel must not invite typing before the first entry has been hydrated.
  const [loadInFlight, setLoadInFlight] = createSignal(true);

  /**
   * Reconciles the display after the persistence coordinator auto-deleted the blank entry
   * the editor was showing. The coordinator has already refreshed `dayEntries` and the
   * calendar dates; only "which entry shows now" is decided here, because that needs
   * `currentIndex` and the atomic commit helpers.
   */
  const onEmptyEntryDeleted = async (remaining: DiaryEntry[], isStale: () => boolean) => {
    if (remaining.length > 0) {
      // Other entries remain — navigate to the nearest so the editor always shows
      // real content after a blank entry is auto-deleted. Without this, switching
      // days and back leaves pendingEntryId=null with stale blank content,
      // permanently disabling the "+" button (Bug 2).
      const newIdx = Math.min(opts.currentIndex(), remaining.length - 1);
      const entry = remaining[newIdx];
      const html = await resolveEntryHtml(entry);
      if (isStale()) return;
      commitEntryToEditor(entryCommitTargets, entry, html, newIdx);
      // Prevent the debounced save that setContent triggers via TipTap —
      // the remaining entry is already persisted and has not changed.
      persistence.debouncedSave.cancel();
    } else {
      // No entries remain — reset so the next keystroke creates a fresh entry. Title and
      // content are deliberately left alone: the document the user is looking at is
      // already the blank one that was just deleted.
      batch(() => {
        opts.setPendingEntryId(null);
        opts.setCurrentIndex(0);
        opts.setWordCount(0);
        opts.setEntryMetadata(null);
      });
      entryCommitTargets.setHydratedEntryId(null);
    }
  };

  const persistence = useEntryPersistence({
    editorInstance: opts.editorInstance,
    title: opts.title,
    content: opts.content,
    pendingEntryId: opts.pendingEntryId,
    entryMetadata: opts.entryMetadata,
    dayEntries: opts.dayEntries,
    setDayEntries: opts.setDayEntries,
    onEmptyEntryDeleted,
  });

  const entryCommitTargets: EntryCommitTargets = {
    setCurrentIndex: opts.setCurrentIndex,
    setPendingEntryId: opts.setPendingEntryId,
    setTitle: opts.setTitle,
    setContent: opts.setContent,
    setWordCount: opts.setWordCount,
    setEntryMetadata: opts.setEntryMetadata,
    setHydratedEntryId: persistence.setHydratedEntryId,
  };

  /**
   * Acts on a keystroke that was deferred because a load was in flight. If the load
   * supplied a real entry, its body has replaced whatever was typed into the pre-load
   * editor and there is nothing left to create.
   */
  const drainQueuedCreation = () => {
    const queued = queuedCreationReason;
    queuedCreationReason = null;
    if (queued === null || persistence.isDisposed()) return;
    if (untrack(opts.pendingEntryId) !== null) {
      log.info(`${queued}: deferred creation dropped — the load supplied an entry`);
      return;
    }
    const stillHasContent = untrack(() => {
      // The deferred keystroke may have been a title one — check both, or a title-only
      // intent (handleTitleInput on a blank day) is silently dropped.
      if (opts.title().trim() !== '') return true;
      const edInst = opts.editorInstance();
      const live = edInst && !edInst.isDestroyed ? edInst : null;
      return !computeIsEmpty(live, live ? live.getHTML() : opts.content());
    });
    if (!stillHasContent) return;
    startEntryCreation(`${queued} (deferred)`);
  };

  const loadEntriesForDate = async (date: string) => {
    const requestId = ++loadRequestId;
    setLoadInFlight(true);

    try {
      // Flush an in-flight createEntry() first — if pendingEntryId is still null because
      // creation hasn't resolved yet, the flush below would no-op and the typed content
      // would be lost/misattributed to the new date. See TODO-0089.
      await flushPendingCreation();
      if (persistence.isDisposed() || requestId !== loadRequestId) return;

      // Flush any pending save for the current entry before switching dates.
      await persistence.flushCurrent('loadEntriesForDate');
      if (persistence.isDisposed() || requestId !== loadRequestId) return;

      const entries = await fetchEntriesOrdered(date);
      if (persistence.isDisposed() || requestId !== loadRequestId) return;

      opts.setDayEntries(entries);

      // One-shot deep-link from search: open the requested entry within the day rather
      // than the day's newest. Read+clear under untrack (we are still in the calling
      // effect's tracking scope before the first await above has rerun this block).
      const targetEntryId = untrack(selectedEntryId);
      if (targetEntryId !== null) setSelectedEntryId(null);

      if (entries.length > 0) {
        const targetIndex =
          targetEntryId !== null ? entries.findIndex((e) => e.id === targetEntryId) : -1;
        // newest entry is last in chronological order; fall back to it when no deep-link match
        const startIndex = targetIndex >= 0 ? targetIndex : entries.length - 1;
        const entry = entries[startIndex];
        // Resolve everything the commit needs BEFORE touching a single signal — see
        // commitEntryToEditor's contract.
        const html = await resolveEntryHtml(entry);
        if (persistence.isDisposed() || requestId !== loadRequestId) return;
        commitEntryToEditor(entryCommitTargets, entry, html, startIndex);
      } else {
        clearEntryFromEditor(entryCommitTargets);
      }
    } catch (error) {
      log.error('Failed to load entries:', error);
      // Leave a coherent state. Nothing was committed, so the editor may still be showing
      // the previous entry — drop the hydration marker so the next flush is refused rather
      // than writing that document onto whatever pendingEntryId happens to hold.
      persistence.setHydratedEntryId(null);
    } finally {
      if (requestId === loadRequestId) {
        setLoadInFlight(false);
        drainQueuedCreation();
      }
    }
  };

  const startEntryCreation = (reason: string) => {
    if (untrack(opts.isCreatingEntry)) {
      log.debug(`${reason}: isCreatingEntry guard fired — skipping duplicate creation`);
      return;
    }
    if (untrack(loadInFlight)) {
      // The keystroke landed in an editor that loadEntriesForDate is about to overwrite.
      // Creating now would duplicate the day's entry or attach the content to the wrong
      // id, so queue the intent and re-evaluate once the load settles. See TODO-0089.
      queuedCreationReason = reason;
      log.info(`${reason}: load in flight — deferring entry creation`);
      return;
    }
    const date = untrack(opts.selectedDate);
    log.info(`${reason}: pendingEntryId null — creating entry for date ${date}`);
    opts.setIsCreatingEntry(true);
    const creationPromise = createEntry(date);
    pendingCreationPromise = creationPromise;
    void (async () => {
      try {
        const newEntry = await creationPromise;
        if (pendingCreationPromise !== creationPromise) {
          // Preempted: flushPendingCreation() already claimed this promise (a
          // navigation-away path ran first) and will save-or-delete it directly by id.
          log.info(
            `${reason}: createEntry completed but was preempted by a flush, id=${newEntry.id}`,
          );
          return;
        }
        pendingCreationPromise = null;
        if (persistence.isDisposed()) {
          log.warn(
            `${reason}: component disposed during createEntry — id=${newEntry.id}, content will be saved by cleanup callback`,
          );
          return;
        }
        log.info(`${reason}: createEntry completed, id=${newEntry.id}`);
        // The document in the editor IS this entry's content — it is the keystroke that
        // triggered the creation — so id and hydration land together.
        opts.setPendingEntryId(newEntry.id);
        persistence.setHydratedEntryId(newEntry.id);
        const refreshed = await fetchEntriesOrdered(date);
        if (persistence.isDisposed()) return;
        opts.setDayEntries(refreshed);
        // Snapshot rather than re-read live signals field by field: captureCurrentSnapshot
        // refuses to pair an id with a body that is not its own, so a context switch during
        // the fetch above yields a self-consistent payload (or none at all).
        const snap = persistence.captureCurrentSnapshot();
        if (snap !== null) {
          persistence.debouncedSave(
            snap.entryId,
            snap.title,
            snap.content,
            snap.isEmpty,
            snap.metadata,
          );
        }
      } catch (error) {
        if (pendingCreationPromise === creationPromise) pendingCreationPromise = null;
        log.error(`${reason}: failed to create entry:`, error);
      } finally {
        opts.setIsCreatingEntry(false);
      }
    })();
  };

  // Awaits and settles (save-or-delete) an in-flight createEntry() call without touching
  // pendingEntryId/dayEntries/currentIndex — the caller has already moved on to a different
  // context (unmounted, switched date/entry, or is locking). See TODO-0089: without this,
  // content typed into a brand-new entry is lost the instant the user navigates away before
  // createEntry() resolves, because startEntryCreation's own continuation either finds
  // isDisposed=true (unmount) or writes UI state for the wrong context (date/entry switch).
  const flushPendingCreation = async (): Promise<void> => {
    const creationPromise = pendingCreationPromise;
    if (creationPromise === null) return;
    // Claim immediately (before awaiting) so startEntryCreation's own continuation can
    // detect it was preempted via `pendingCreationPromise !== creationPromise`.
    pendingCreationPromise = null;
    // Capture NOW, synchronously. Reading these after the await is the defect this
    // rewrite removes: by then the component may be disposed, the editor destroyed, or
    // the signals repointed at a different entry.
    const captured = untrack(() => {
      const edInst = opts.editorInstance();
      const live = edInst && !edInst.isDestroyed ? edInst : null;
      const content = live ? live.getHTML() : opts.content();
      return {
        title: opts.title(),
        content,
        isEmpty: computeIsEmpty(live, content),
        metadata: opts.entryMetadata(),
      };
    });
    let newEntry: DiaryEntry;
    try {
      newEntry = await creationPromise;
    } catch (error) {
      log.warn('flushPendingCreation: in-flight createEntry failed:', error);
      return;
    }
    await persistence.writeSnapshot({ entryId: newEntry.id, ...captured }, 'flushPendingCreation');
  };

  // Register journal-lock cleanup. Fires when the journal is being locked: we flush any
  // in-flight creation + save so typed content is not lost when the DB closes.

  const unregister = registerCleanupCallback(async () => {
    await flushPendingCreation();
    await persistence.flushCurrent('lockCleanup');
  });

  const dispose = () => {
    // Capture BEFORE flipping isDisposed and before cancelling the debounce. Teardown
    // ordering between DiaryEditor's onCleanup (editor.destroy()) and this call is not
    // stable across builds — dev tears the child down first, release last (see
    // src/CLAUDE.md gotcha #11) — so read the editor while it may still be alive and let
    // computeIsEmpty fall back to content() when it is not.
    const snapshot = persistence.captureCurrentSnapshot();
    persistence.markDisposed();
    loadRequestId += 1;
    persistence.debouncedSave.cancel();
    unregister();
    // Unmount must flush, not drop: the <Show> swap in MainLayout is the Timeline toggle,
    // and every other navigation-away path already flushes before proceeding. writeSnapshot
    // has no disposal guard for exactly this reason.
    void (async () => {
      await flushPendingCreation();
      if (snapshot !== null) await persistence.writeSnapshot(snapshot, 'dispose');
    })();
  };

  return {
    loadEntriesForDate,
    startEntryCreation,
    flushPendingCreation,
    flushCurrent: persistence.flushCurrent,
    debouncedSave: persistence.debouncedSave,
    entryCommitTargets,
    getJustCreatedEntryId: () => justCreatedEntryId,
    setJustCreatedEntryId: (id) => {
      justCreatedEntryId = id;
    },
    isLoadInFlight: loadInFlight,
    isDisposed: persistence.isDisposed,
    dispose,
  };
}
