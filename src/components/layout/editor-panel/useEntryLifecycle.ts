import { batch, createSignal, untrack, type Accessor, type Setter } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { createEntry, deleteEntry, entryHasContent, getAllEntryDates } from '../../../lib/tauri';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import {
  registerCleanupCallback,
  registerReloadCallback,
  registerNavigationGuard,
  setEntryDates,
} from '../../../state/entries';
import { selectedEntryId, setSelectedEntryId } from '../../../state/ui';
import { confirmInApp } from '../../../state/confirm-dialog';
import { createLogger } from '../../../lib/logger';
import type { useI18n } from '../../../i18n';
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
  t: ReturnType<typeof useI18n>;
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
  /**
   * Discards whatever the editor is currently showing and re-fetches the selected date's
   * entries, **without saving**. For when the journal's content changed underneath the app
   * without a lock/unlock cycle (a whole-journal restore, Task 4.2) — flushing here would
   * write pre-restore content back over the restored entry. Registered as a reload callback
   * automatically; exposed for direct use and for tests.
   */
  discardAndReload: () => Promise<void>;
  /**
   * Asks "may I leave the current entry?" (TODO-0104). Returns `true` immediately when
   * there is nothing to protect (no pending entry, or an ordinary save). When leaving
   * would silently erase real on-disk content, shows the in-app confirm dialog and:
   * on cancel, returns `false` (deny); on confirm, hard-deletes the entry, clears the
   * editor, and returns `true` (allow). Also registered as a navigation guard so
   * out-of-`EditorPanel` navigation call sites (Phase 2) go through it too.
   */
  canLeaveCurrentEntry: (path: string) => Promise<boolean>;
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
   * Coalesces concurrent `canLeaveCurrentEntry` callers into one check (TODO-0104
   * follow-up). Two call sites can legitimately race for the same click: a search-result
   * click on an entry already on the open day sets `selectedEntryId` before awaiting its
   * own guarded date/view change, and that write synchronously fires EditorPanel's
   * same-day deep-link effect, which calls `navigateToEntry` — invoking this function a
   * second time for the same "may I leave the current entry?" question before the first
   * call has resolved. Since both callers are asking about the exact same current-entry
   * snapshot, coalescing is correct, not just a race workaround: there is only ever one
   * real answer to ask for. Without this, `confirmInApp()`'s single-pending-call design
   * (see its own doc comment) means the second call's dialog silently overwrites the
   * first's `pendingResolve`, permanently orphaning the first caller's promise — which
   * left `navigateToEntry` hung mid-flight and the intended entry switch never happening.
   */
  let leaveCheckInFlight: Promise<boolean> | null = null;
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

  /**
   * Discards the editor's current entry state and re-fetches the selected date fresh —
   * never saves. `clearEntryFromEditor` nulls `pendingEntryId` first, which is what makes
   * `loadEntriesForDate`'s own `persistence.flushCurrent` call a guaranteed no-op rather
   * than a write of pre-restore content: `captureCurrentSnapshot` returns null the instant
   * there is no pending id to snapshot (see `useEntryPersistence`'s hydration-identity
   * guard). Cancelling the debounce first covers the case where a save was already queued
   * from typing that happened moments before the restore.
   */
  const discardAndReload = async (): Promise<void> => {
    persistence.debouncedSave.cancel();
    clearEntryFromEditor(entryCommitTargets);
    await loadEntriesForDate(untrack(opts.selectedDate));
  };

  /**
   * Re-fetches the given entry's on-disk content and commits it into the editor, without
   * touching `selectedEntryId` — that signal is a shared one-shot deep-link consumed
   * synchronously by EditorPanel's same-day deep-link effect, so writing it here would
   * race that consumer and lose the target before loadEntriesForDate ever reads it back
   * (see docs/entry-persistence-cancel-restore-plan.md's "Multi-Entry Wrinkle" section).
   * Used by canLeaveCurrentEntry's cancel branch (TODO-0104 addendum) to restore real
   * content the user just erased, instead of leaving the editor showing the blank state
   * that triggered the confirm dialog.
   *
   * Shares `loadRequestId` with `loadEntriesForDate` (same staleness token, same
   * increment-then-compare pattern) so a concurrent unrelated load — e.g. a lock/unlock
   * or a whole-journal restore firing while these awaits are in flight — cannot have its
   * result stomped by this one committing late. If the two awaits below reject (a
   * transient IPC failure, or the DB going away mid-teardown), the rejection propagates
   * to checkCanLeaveCurrentEntry's own try/catch, which already denies navigation and
   * logs — the editor is simply left as it was, not worse off than before this function
   * existed.
   */
  const restoreEntryFromDisk = async (entryId: number): Promise<void> => {
    persistence.debouncedSave.cancel();
    const requestId = ++loadRequestId;
    const isStale = () => persistence.isDisposed() || requestId !== loadRequestId;
    const date = untrack(opts.selectedDate);
    const entries = await fetchEntriesOrdered(date);
    if (isStale()) return;
    opts.setDayEntries(entries);
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx < 0) {
      // Entry vanished between entryHasContent's check and now (shouldn't happen in
      // practice) — clear rather than commit a mismatched index.
      clearEntryFromEditor(entryCommitTargets);
      return;
    }
    const entry = entries[idx];
    const html = await resolveEntryHtml(entry);
    if (isStale()) return;
    commitEntryToEditor(entryCommitTargets, entry, html, idx);
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

  /**
   * Asks "may I leave the current entry?" — see the `EntryLifecycleHook.canLeaveCurrentEntry`
   * doc comment for the contract. TODO-0104.
   *
   * Coalesces with any concurrent caller via `leaveCheckInFlight` — see that field's doc
   * comment for why two independent call sites can legitimately race for one user action.
   */
  const canLeaveCurrentEntry = (path: string): Promise<boolean> => {
    if (leaveCheckInFlight) return leaveCheckInFlight;
    const run = async (): Promise<boolean> => {
      try {
        return await checkCanLeaveCurrentEntry(path);
      } finally {
        leaveCheckInFlight = null;
      }
    };
    leaveCheckInFlight = run();
    return leaveCheckInFlight;
  };

  const checkCanLeaveCurrentEntry = async (path: string): Promise<boolean> => {
    try {
      const snap = persistence.captureCurrentSnapshot();
      if (snap === null) return true;

      // Same save-vs-delete decision saveCurrentById uses — an ordinary save needs no consent.
      const shouldDelete = snap.title.trim() === '' && snap.isEmpty;
      if (!shouldDelete) return true;

      let hasContent: boolean;
      try {
        hasContent = await entryHasContent(snap.entryId);
      } catch (error) {
        // The entry can legitimately be gone by the time this runs: the debounced
        // autosave (independent of this guard) may already have auto-deleted it via
        // deleteEntryIfEmpty in the ~500ms before this call. "Entry not found" means
        // there is nothing left to protect — allow navigation rather than denying it,
        // or every such race would silently freeze the calling UI action (e.g. leave
        // the Sidebar open on a denied calendar-day click). Any other failure still
        // falls through to the outer catch and denies.
        const message =
          typeof error === 'string' ? error : error instanceof Error ? error.message : '';
        if (/entry not found/i.test(message)) return true;
        throw error;
      }
      if (!hasContent) return true; // on-disk row is already blank — nothing to protect

      const confirmed = await confirmInApp(opts.t('editor.deleteConfirmMessage'), {
        title: opts.t('editor.deleteConfirmTitle'),
      });
      if (!confirmed) {
        await restoreEntryFromDisk(snap.entryId);
        log.info(
          `${path}: canLeaveCurrentEntry cancelled — restored entry ${snap.entryId} from disk`,
        );
        return false;
      }

      persistence.debouncedSave.cancel();
      await deleteEntry(snap.entryId);
      clearEntryFromEditor(entryCommitTargets);
      // Mirrors saveCurrentById's soft-delete branch: the calendar/timeline indicators
      // read entryDates as a separate global signal, so a hard delete outside that path
      // must refresh it too or "has entry" goes stale for this date.
      const dates = await getAllEntryDates();
      if (!persistence.isDisposed()) setEntryDates(dates);
      log.info(`${path}: canLeaveCurrentEntry confirmed delete of entry ${snap.entryId}`);
      return true;
    } catch (error) {
      log.error(`${path}: canLeaveCurrentEntry failed — denying navigation:`, error);
      return false;
    }
  };

  // Register journal-lock cleanup. Fires when the journal is being locked: we flush any
  // in-flight creation + save so typed content is not lost when the DB closes.

  const unregister = registerCleanupCallback(async () => {
    await flushPendingCreation();
    await persistence.flushCurrent('lockCleanup');
  });

  // Register the discard-and-reload callback (Task 4.2). Unlike the cleanup callback above,
  // this one must never flush — see discardAndReload's doc comment.
  const unregisterReload = registerReloadCallback(discardAndReload);

  // Register the navigation guard so Phase 2 call sites (outside EditorPanel) go through
  // canLeaveCurrentEntry too, via requestNavigationConsent(). TODO-0104.
  const unregisterNavigationGuard = registerNavigationGuard(() =>
    canLeaveCurrentEntry('navigationGuard'),
  );

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
    unregisterReload();
    unregisterNavigationGuard();
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
    discardAndReload,
    canLeaveCurrentEntry,
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
