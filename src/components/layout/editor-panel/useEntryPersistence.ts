import { untrack, type Accessor, type Setter } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { saveEntry, deleteEntryIfEmpty, getAllEntryDates } from '../../../lib/tauri';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import { debounce } from '../../../lib/debounce';
import { setEntryDates, setIsSaving } from '../../../state/entries';
import { createLogger } from '../../../lib/logger';
import { computeIsEmpty } from './useEditorEmptyCheck';

const log = createLogger('Editor');

/**
 * A write payload captured atomically from live state. Safe to carry across an await:
 * every field belongs to the same entry, at the same instant, including the save-vs-delete
 * decision (`isEmpty`) and the metadata written alongside the body. See TODO-0089.
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
  metadataArg: EntryMetadata | null,
) => void) & {
  cancel: () => void;
};

export interface UseEntryPersistenceOptions {
  editorInstance: Accessor<Editor | null>;
  title: Accessor<string>;
  content: Accessor<string>;
  pendingEntryId: Accessor<number | null>;
  entryMetadata: Accessor<EntryMetadata | null>;
  dayEntries: Accessor<DiaryEntry[]>;
  setDayEntries: Setter<DiaryEntry[]>;
  /**
   * Decides which entry the editor shows once an auto-delete has removed the one it was
   * displaying. The coordinator owns the data refresh (`dayEntries`, `entryDates`) and
   * hands over only that decision — the reconcile needs `currentIndex` and the atomic
   * commit helpers, which belong to the lifecycle hook.
   *
   * `isStale()` re-checks the coordinator's disposal/request guard: the callback awaits
   * an image resolve of its own, and a commit that lands after a newer write has
   * superseded this one is exactly the wrong-context write TODO-0089 removed.
   */
  onEmptyEntryDeleted: (remaining: DiaryEntry[], isStale: () => boolean) => Promise<void>;
}

export interface EntryPersistenceHook {
  /**
   * Debounced save. The emptiness decision and the metadata travel with the payload
   * (captured at the keystroke that queued it) instead of being re-read when the timer
   * fires 500 ms later — a live re-read is how a destroyed editor or a reset content()
   * signal used to turn a real edit into a delete. See TODO-0089.
   */
  debouncedSave: DebouncedSaveFn;
  /**
   * The single entry point for every "flush before navigating away" path: cancels the
   * debounce, snapshots the live editor, and writes it. The raw `saveCurrentById` is
   * deliberately NOT exposed — going through it directly is how a caller ends up pairing
   * an id with a body that is not its own. See TODO-0089.
   */
  flushCurrent: (path: string) => Promise<void>;
  captureCurrentSnapshot: () => SaveSnapshot | null;
  writeSnapshot: (snap: SaveSnapshot, path: string) => Promise<void>;
  /** Records the entry whose body has actually reached the editor. */
  setHydratedEntryId: (id: number | null) => void;
  getHydratedEntryId: () => number | null;
  isDisposed: () => boolean;
  /** Flips the disposal flag and invalidates every in-flight write. */
  markDisposed: () => void;
}

/**
 * Owns the write path: snapshot capture, the hydration identity guard, the debounce, and
 * the save-vs-delete decision. Split out of `useEntryLifecycle` so neither half exceeds
 * the 350-line hook limit and so the delete branch is directly testable.
 *
 * The lifecycle hook keeps load/creation/teardown orchestration and drives this
 * coordinator; nothing else may reach it.
 */
export function useEntryPersistence(opts: UseEntryPersistenceOptions): EntryPersistenceHook {
  let isDisposed = false;
  let saveRequestId = 0;
  /**
   * The entry whose body has actually been applied to the editor. `pendingEntryId` alone
   * is not enough: it says which entry we *intend* to edit, this says which entry the
   * document in front of the user actually is. A write is only allowed when they agree.
   */
  let hydratedEntryId: number | null = null;

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
    metadata: EntryMetadata | null,
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
    const isStale = () => isDisposed || requestId !== saveRequestId;

    // save-vs-delete comes from the caller's snapshot, never from a live re-read: the
    // debounce fires up to 500 ms after the payload was captured.
    const shouldDelete = currentTitle.trim() === '' && isEmpty;
    if (shouldDelete) {
      try {
        logWrite(path, 'deleteEntryIfEmpty', entryId, currentTitle, currentContent, true);
        // Pass the real content, not '': the backend re-checks emptiness and is the last
        // line of defence against a wrong-context delete.
        const deleted = await deleteEntryIfEmpty(entryId, currentTitle, currentContent);
        if (isStale()) return;
        if (!deleted) {
          log.warn(`${path}: backend refused to delete entry ${entryId} — content was not blank`);
          return;
        }
        const updatedEntries = opts.dayEntries().filter((e) => e.id !== entryId);
        opts.setDayEntries(updatedEntries);
        const dates = await getAllEntryDates();
        if (isStale()) return;
        setEntryDates(dates);
        // Which entry the editor shows next is the lifecycle hook's call — it owns
        // currentIndex and the atomic commit helpers.
        await opts.onEmptyEntryDeleted(updatedEntries, isStale);
      } catch (error) {
        log.error('Failed to delete empty entry:', error);
      }
      return;
    }

    try {
      setIsSaving(true);
      logWrite(path, 'saveEntry', entryId, currentTitle, currentContent, isEmpty);
      await saveEntry(entryId, currentTitle, currentContent, metadata);
      if (isStale()) return;

      const dates = await getAllEntryDates();
      if (isStale()) return;
      setEntryDates(dates);
    } catch (error) {
      log.error('Failed to save entry:', error);
    } finally {
      if (!isStale()) {
        setIsSaving(false);
      }
    }
  };

  const debouncedSave = debounce(
    (
      entryId: number,
      titleArg: string,
      contentArg: string,
      isEmptyArg: boolean,
      metadataArg: EntryMetadata | null,
    ) => {
      void saveCurrentById(entryId, titleArg, contentArg, isEmptyArg, metadataArg, 'debouncedSave');
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
      saveCurrentById(snap.entryId, snap.title, snap.content, snap.isEmpty, snap.metadata, path),
    );
  };

  return {
    debouncedSave,
    flushCurrent,
    captureCurrentSnapshot,
    writeSnapshot,
    setHydratedEntryId: (id) => {
      hydratedEntryId = id;
    },
    getHydratedEntryId: () => hydratedEntryId,
    isDisposed: () => isDisposed,
    markDisposed: () => {
      isDisposed = true;
      // Invalidate every in-flight write so a late continuation cannot touch UI state
      // after teardown.
      saveRequestId += 1;
    },
  };
}
