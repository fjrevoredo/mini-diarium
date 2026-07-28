import { batch, createSignal, untrack, type Accessor, type Setter } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { createEntry, saveEntry, deleteEntryIfEmpty, getAllEntryDates } from '../../../lib/tauri';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import { debounce } from '../../../lib/debounce';
import { setEntryDates, setIsSaving, registerCleanupCallback } from '../../../state/entries';
import { selectedEntryId, setSelectedEntryId } from '../../../state/ui';
import { createLogger } from '../../../lib/logger';
import { computeIsEmpty, type EditorEmptyCheckHook } from './useEditorEmptyCheck';
import { fetchEntriesOrdered } from './useMultiEntryNav';
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

/**
 * A write payload captured atomically from live state. Safe to carry across an await:
 * every field belongs to the same entry, at the same instant, including the save-vs-delete
 * decision (`isEmpty`). See TODO-0089.
 */
export interface SaveSnapshot {
  entryId: number;
  title: string;
  content: string;
  isEmpty: boolean;
  metadata: EntryMetadata | null;
}

export type DebouncedSaveFn = ((
  entryId: number,
  titleArg: string,
  contentArg: string,
  isEmptyArg: boolean,
) => void) & {
  cancel: () => void;
};

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
  /**
   * The single entry point for every "flush before navigating away" path: cancels the
   * debounce, snapshots the live editor, and writes it. The raw `saveCurrentById` is
   * deliberately NOT exposed — going through it directly is how a caller ends up pairing
   * an id with a body that is not its own. See TODO-0089.
   */
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

export function useEntryLifecycle(opts: UseEntryLifecycleOptions): EntryLifecycleHook {
  let isDisposed = false;
  let loadRequestId = 0;
  let saveRequestId = 0;
  let pendingCreationPromise: Promise<DiaryEntry> | null = null;
  let justCreatedEntryId: number | null = null;
  /**
   * The entry whose body has actually been applied to the editor. `pendingEntryId` alone
   * is not enough: it says which entry we *intend* to edit, this says which entry the
   * document in front of the user actually is. A write is only allowed when they agree.
   */
  let hydratedEntryId: number | null = null;
  /**
   * A keystroke that arrived while a load was in flight. The creation it asked for is
   * re-evaluated once the load settles rather than acted on immediately. See TODO-0089.
   */
  let queuedCreationReason: string | null = null;

  // Starts true: the mount-time load effect always runs, and the auto-focus effect in
  // EditorPanel must not invite typing before the first entry has been hydrated.
  const [loadInFlight, setLoadInFlight] = createSignal(true);

  const entryCommitTargets: EntryCommitTargets = {
    setCurrentIndex: opts.setCurrentIndex,
    setPendingEntryId: opts.setPendingEntryId,
    setTitle: opts.setTitle,
    setContent: opts.setContent,
    setWordCount: opts.setWordCount,
    setEntryMetadata: opts.setEntryMetadata,
    setHydratedEntryId: (id) => {
      hydratedEntryId = id;
    },
  };

  /**
   * Write-audit trail (TODO-0089). Deliberately `info`, not `debug`: `createLogger`
   * compiles `debug` out of production builds, and a console record of every write is
   * the only way to confirm or refute a body-wipe recurrence in a release build.
   * Lengths only — never the title or body text (Security Rules).
   *
   * `isEmpty` is the emptiness verdict for the body, NOT the save-vs-delete decision —
   * those differ whenever a blank body is kept alive by a non-empty title, and `op`
   * already reports the decision. Logging the decision here instead reads as "the body
   * had content" on exactly the writes that wipe one, which is how a body-wipe
   * investigation gets sent in the wrong direction.
   */
  const logWrite = (
    path: string,
    op: 'saveEntry' | 'deleteEntryIfEmpty',
    entryId: number,
    title: string,
    content: string,
    isEmpty: boolean,
  ) => {
    log.info(
      `write op=${op} path=${path} entryId=${entryId} titleLen=${title.length} contentLen=${content.length} isEmpty=${isEmpty}`,
    );
  };

  /**
   * Snapshots the editor's current state, or returns null when there is nothing safe to
   * write. Reads are synchronous and untracked so the result can be carried across an
   * await and used from a tracking scope alike.
   */
  const captureCurrentSnapshot = (): SaveSnapshot | null =>
    untrack(() => {
      const entryId = opts.pendingEntryId();
      if (entryId === null) return null;
      if (hydratedEntryId !== entryId) {
        log.warn(
          `snapshot: entry ${entryId} is not hydrated (hydrated=${hydratedEntryId}) — skipping flush`,
        );
        return null;
      }
      const edInst = opts.editorInstance();
      // Read the TipTap document directly rather than the content() signal — node-attribute
      // transactions (alignment) may not have propagated to the signal yet. Falls back to
      // the signal once the editor is destroyed, which is already the case during dispose()
      // in dev builds but not in release ones (see src/CLAUDE.md gotcha #11).
      const live = edInst && !edInst.isDestroyed ? edInst : null;
      const content = live ? live.getHTML() : opts.content();
      return {
        entryId,
        title: opts.title(),
        content,
        isEmpty: computeIsEmpty(live, content),
        metadata: opts.entryMetadata(),
      };
    });

  /**
   * Writes a captured snapshot straight to the backend, touching no UI state.
   *
   * Used by the teardown paths (dispose, flushPendingCreation) which run after the
   * component is gone: there is nothing left to update, but the typed content must still
   * land in the DB. Deliberately has no `isDisposed` guard — that is the whole point.
   */
  const writeSnapshot = async (snap: SaveSnapshot, path: string): Promise<void> => {
    try {
      if (snap.title.trim() === '' && snap.isEmpty) {
        logWrite(path, 'deleteEntryIfEmpty', snap.entryId, snap.title, snap.content, true);
        await deleteEntryIfEmpty(snap.entryId, snap.title, snap.content);
      } else {
        logWrite(path, 'saveEntry', snap.entryId, snap.title, snap.content, snap.isEmpty);
        await saveEntry(snap.entryId, snap.title, snap.content, snap.metadata);
      }
    } catch (error) {
      log.warn(`${path}: failed to write entry ${snap.entryId}:`, error);
    }
  };

  const saveCurrentById = async (
    entryId: number,
    currentTitle: string,
    currentContent: string,
    isEmpty: boolean,
    path = 'saveCurrentById',
  ) => {
    if (isDisposed) return;
    // Belt to the atomic-commit braces: refuse to write a body for an entry whose own
    // content never reached the editor. Without this, a superseded or failed load leaves
    // pendingEntryId/title pointing at a real entry while the document is still blank,
    // and the next flush persists that blank as the entry's body. See TODO-0089.
    if (hydratedEntryId !== entryId) {
      log.warn(
        `${path}: refusing to write entry ${entryId} — editor is hydrated for ${hydratedEntryId}`,
      );
      return;
    }
    const requestId = ++saveRequestId;

    // save-vs-delete comes from the caller's snapshot, never from a live re-read: the
    // debounce fires up to 500 ms after the payload was captured.
    const shouldDelete = currentTitle.trim() === '' && isEmpty;
    if (shouldDelete) {
      try {
        logWrite(path, 'deleteEntryIfEmpty', entryId, currentTitle, currentContent, true);
        // Pass the real content, not '': the backend re-checks emptiness and is the last
        // line of defence against a wrong-context delete.
        const deleted = await deleteEntryIfEmpty(entryId, currentTitle, currentContent);
        if (isDisposed || requestId !== saveRequestId) return;
        if (!deleted) {
          log.warn(`${path}: backend refused to delete entry ${entryId} — content was not blank`);
          return;
        }
        const updatedEntries = opts.dayEntries().filter((e) => e.id !== entryId);
        opts.setDayEntries(updatedEntries);
        const dates = await getAllEntryDates();
        if (isDisposed || requestId !== saveRequestId) return;
        setEntryDates(dates);
        if (updatedEntries.length > 0) {
          // Other entries remain — navigate to the nearest so the editor always shows
          // real content after a blank entry is auto-deleted. Without this, switching
          // days and back leaves pendingEntryId=null with stale blank content,
          // permanently disabling the "+" button (Bug 2).
          const newIdx = Math.min(opts.currentIndex(), updatedEntries.length - 1);
          const entry = updatedEntries[newIdx];
          const html = await resolveEntryHtml(entry);
          if (isDisposed || requestId !== saveRequestId) return;
          commitEntryToEditor(entryCommitTargets, entry, html, newIdx);
          // Prevent the debounced save that setContent triggers via TipTap —
          // the remaining entry is already persisted and has not changed.
          debouncedSave.cancel();
        } else {
          // No entries remain — reset so the next keystroke creates a fresh entry.
          batch(() => {
            opts.setPendingEntryId(null);
            opts.setCurrentIndex(0);
            opts.setWordCount(0);
            opts.setEntryMetadata(null);
          });
          hydratedEntryId = null;
        }
      } catch (error) {
        log.error('Failed to delete empty entry:', error);
      }
      return;
    }

    try {
      setIsSaving(true);
      logWrite(path, 'saveEntry', entryId, currentTitle, currentContent, isEmpty);
      await saveEntry(entryId, currentTitle, currentContent, opts.entryMetadata());
      if (isDisposed || requestId !== saveRequestId) return;

      const dates = await getAllEntryDates();
      if (isDisposed || requestId !== saveRequestId) return;
      setEntryDates(dates);
    } catch (error) {
      log.error('Failed to save entry:', error);
    } finally {
      if (!isDisposed && requestId === saveRequestId) {
        setIsSaving(false);
      }
    }
  };

  // Debounced save. The emptiness decision travels with the payload (captured at the
  // keystroke that queued it) instead of being re-read when the timer fires 500 ms later —
  // a live re-read is how a destroyed editor or a reset content() signal used to turn a
  // real edit into a delete. See TODO-0089.
  const debouncedSave = debounce(
    (entryId: number, titleArg: string, contentArg: string, isEmptyArg: boolean) => {
      void saveCurrentById(entryId, titleArg, contentArg, isEmptyArg, 'debouncedSave');
    },
    500,
  ) as DebouncedSaveFn;

  /**
   * Cancels the pending debounce, snapshots the live editor state, and writes it.
   *
   * Every signal read happens synchronously and untracked: callers include
   * loadEntriesForDate, which runs inside a createEffect, and a tracked read of
   * pendingEntryId/title/content there would make the load re-fire on every keystroke
   * (reactive loop).
   */
  const flushCurrent = async (path: string): Promise<void> => {
    debouncedSave.cancel();
    const snap = captureCurrentSnapshot();
    if (snap === null) return;
    await untrack(() =>
      saveCurrentById(snap.entryId, snap.title, snap.content, snap.isEmpty, path),
    );
  };

  /**
   * Acts on a keystroke that was deferred because a load was in flight. If the load
   * supplied a real entry, its body has replaced whatever was typed into the pre-load
   * editor and there is nothing left to create.
   */
  const drainQueuedCreation = () => {
    const queued = queuedCreationReason;
    queuedCreationReason = null;
    if (queued === null || isDisposed) return;
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
      if (isDisposed || requestId !== loadRequestId) return;

      // Flush any pending save for the current entry before switching dates.
      await flushCurrent('loadEntriesForDate');
      if (isDisposed || requestId !== loadRequestId) return;

      const entries = await fetchEntriesOrdered(date);
      if (isDisposed || requestId !== loadRequestId) return;

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
        if (isDisposed || requestId !== loadRequestId) return;
        commitEntryToEditor(entryCommitTargets, entry, html, startIndex);
      } else {
        clearEntryFromEditor(entryCommitTargets);
      }
    } catch (error) {
      log.error('Failed to load entries:', error);
      // Leave a coherent state. Nothing was committed, so the editor may still be showing
      // the previous entry — drop the hydration marker so the next flush is refused rather
      // than writing that document onto whatever pendingEntryId happens to hold.
      hydratedEntryId = null;
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
        if (isDisposed) {
          log.warn(
            `${reason}: component disposed during createEntry — id=${newEntry.id}, content will be saved by cleanup callback`,
          );
          return;
        }
        log.info(`${reason}: createEntry completed, id=${newEntry.id}`);
        // The document in the editor IS this entry's content — it is the keystroke that
        // triggered the creation — so id and hydration land together.
        opts.setPendingEntryId(newEntry.id);
        hydratedEntryId = newEntry.id;
        const refreshed = await fetchEntriesOrdered(date);
        if (isDisposed) return;
        opts.setDayEntries(refreshed);
        // Snapshot rather than re-read live signals field by field: captureCurrentSnapshot
        // refuses to pair an id with a body that is not its own, so a context switch during
        // the fetch above yields a self-consistent payload (or none at all).
        const snap = captureCurrentSnapshot();
        if (snap !== null) {
          debouncedSave(snap.entryId, snap.title, snap.content, snap.isEmpty);
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
    await writeSnapshot({ entryId: newEntry.id, ...captured }, 'flushPendingCreation');
  };

  // Register journal-lock cleanup. Fires when the journal is being locked: we flush any
  // in-flight creation + save so typed content is not lost when the DB closes.

  const unregister = registerCleanupCallback(async () => {
    await flushPendingCreation();
    await flushCurrent('lockCleanup');
  });

  const dispose = () => {
    // Capture BEFORE flipping isDisposed and before cancelling the debounce. Teardown
    // ordering between DiaryEditor's onCleanup (editor.destroy()) and this call is not
    // stable across builds — dev tears the child down first, release last (see
    // src/CLAUDE.md gotcha #11) — so read the editor while it may still be alive and let
    // computeIsEmpty fall back to content() when it is not.
    const snapshot = captureCurrentSnapshot();
    isDisposed = true;
    loadRequestId += 1;
    saveRequestId += 1;
    debouncedSave.cancel();
    unregister();
    // Unmount must flush, not drop: the <Show> swap in MainLayout is the Timeline toggle,
    // and every other navigation-away path already flushes before proceeding.
    void (async () => {
      await flushPendingCreation();
      if (snapshot !== null) await writeSnapshot(snapshot, 'dispose');
    })();
  };

  return {
    loadEntriesForDate,
    startEntryCreation,
    flushPendingCreation,
    flushCurrent,
    debouncedSave,
    entryCommitTargets,
    getJustCreatedEntryId: () => justCreatedEntryId,
    setJustCreatedEntryId: (id) => {
      justCreatedEntryId = id;
    },
    isLoadInFlight: loadInFlight,
    isDisposed: () => isDisposed,
    dispose,
  };
}
