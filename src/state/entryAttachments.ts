import { createSignal, untrack } from 'solid-js';
import { type AttachmentSummary, listEntryAttachments } from '../lib/tauri';

/**
 * The open entry's attachment list (TODO-0114). `EntryAttachments` owns loading and
 * mutation; the `attachmentRef` NodeView only reads it to resolve an id to a name, so
 * both must see the same list — hence module state rather than component state.
 *
 * Metadata only: attachment bytes never reach the frontend.
 */
const [entryAttachments, setEntryAttachments] = createSignal<AttachmentSummary[]>([]);
const [attachmentsEntryId, setAttachmentsEntryId] = createSignal<number | null>(null);
// False while a load is in flight, so the NodeView does not flag a ref as missing
// before the list for its entry has arrived.
const [attachmentsLoaded, setAttachmentsLoaded] = createSignal(false);
// Bumped by resetEntryAttachmentsState() so a still-mounted strip reloads (e.g. after a
// whole-journal restore, where the open entry id can stay the same).
const [attachmentsVersion, setAttachmentsVersion] = createSignal(0);

// One counter for every change to the list: loads, mutations, and clears all bump it. A
// load writes its reply only when nothing changed the list while it was in flight.
let revision = 0;
// The revision of the newest load. A load whose revision is no longer this one was
// superseded by a newer load or a clear and must drop its reply.
let activeLoad = 0;

/**
 * Loads the list for `entryId`, latest call wins. If an add or remove changes the list
 * while the request is in flight, its reply is older than that change, so it fetches again
 * instead of writing it. Rejects with the raw backend error, but only while it is still the
 * newest load: a superseded load resolves quietly, so its error cannot reach a newer context.
 */
export async function loadEntryAttachments(entryId: number): Promise<void> {
  let rev = ++revision;
  activeLoad = rev;
  setAttachmentsEntryId(entryId);
  setAttachmentsLoaded(false);
  setEntryAttachments([]);
  for (;;) {
    let list: AttachmentSummary[];
    try {
      list = await listEntryAttachments(entryId);
    } catch (err) {
      if (activeLoad !== rev) return;
      throw err;
    }
    if (activeLoad !== rev) return; // a newer load or a clear owns the list now
    if (revision === rev) {
      setEntryAttachments(list);
      setAttachmentsLoaded(true);
      return;
    }
    rev = ++revision; // a mutation landed meanwhile: this reply predates it
    activeLoad = rev;
  }
}

/** Adds or replaces one attachment in the list (backend dedup can return an existing one). */
export function upsertEntryAttachment(entryId: number, attachment: AttachmentSummary): void {
  if (attachmentsEntryId() !== entryId) return;
  revision++;
  setEntryAttachments((prev) =>
    prev.some((a) => a.id === attachment.id)
      ? prev.map((a) => (a.id === attachment.id ? attachment : a))
      : [...prev, attachment],
  );
}

export function removeEntryAttachmentFromList(entryId: number, attachmentId: number): void {
  if (attachmentsEntryId() !== entryId) return;
  revision++;
  setEntryAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
}

/** Clears the list without asking a mounted strip to reload (entry closed). */
export function clearEntryAttachments(): void {
  revision++;
  activeLoad = 0;
  setEntryAttachments([]);
  setAttachmentsEntryId(null);
  setAttachmentsLoaded(false);
}

/** Session reset (lock, journal switch, restore). See `session.ts`. */
export function resetEntryAttachmentsState(): void {
  clearEntryAttachments();
  setAttachmentsVersion((v) => v + 1);
}

// The strip registers how a "save a copy" request is handled (dialog + localized error
// display); the NodeView, which has neither, only forwards the click.
let saveCopyHandler: ((attachmentId: number) => void) | null = null;

export function registerSaveCopyHandler(handler: (attachmentId: number) => void): () => void {
  saveCopyHandler = handler;
  return () => {
    if (saveCopyHandler === handler) saveCopyHandler = null;
  };
}

export function requestSaveAttachmentCopy(attachmentId: number): void {
  saveCopyHandler?.(attachmentId);
}

export { entryAttachments, attachmentsEntryId, attachmentsLoaded, attachmentsVersion };

/**
 * Untracked: what the loaded list says about `entryId`'s attachments. `'unknown'` when the
 * list belongs to another entry or is still loading — callers that must not guess (the
 * save-vs-delete decision) then ask the backend, see `entryHasAttachments`.
 */
export function attachmentPresence(entryId: number): 'has' | 'none' | 'unknown' {
  return untrack(() => {
    if (attachmentsEntryId() !== entryId) return 'unknown';
    if (entryAttachments().length > 0) return 'has';
    return attachmentsLoaded() ? 'none' : 'unknown';
  });
}

/**
 * Whether `entryId` has attachments, from the loaded list when it is known for that entry,
 * otherwise from the backend. An entry with attachments is never blank (TODO-0114), and a
 * wrong "no" would send it down a delete path, so every doubt answers "yes": a failed
 * backend check keeps the entry.
 */
export async function entryHasAttachments(entryId: number): Promise<boolean> {
  const known = attachmentPresence(entryId);
  if (known !== 'unknown') return known === 'has';
  try {
    return (await listEntryAttachments(entryId)).length > 0;
  } catch {
    return true;
  }
}
