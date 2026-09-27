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

let loadToken = 0;

/** Loads the list for `entryId`, latest call wins. Rejects with the raw backend error. */
export async function loadEntryAttachments(entryId: number): Promise<void> {
  const token = ++loadToken;
  setAttachmentsEntryId(entryId);
  setAttachmentsLoaded(false);
  setEntryAttachments([]);
  const list = await listEntryAttachments(entryId);
  if (token !== loadToken) return;
  setEntryAttachments(list);
  setAttachmentsLoaded(true);
}

/** Adds or replaces one attachment in the list (backend dedup can return an existing one). */
export function upsertEntryAttachment(entryId: number, attachment: AttachmentSummary): void {
  if (attachmentsEntryId() !== entryId) return;
  setEntryAttachments((prev) =>
    prev.some((a) => a.id === attachment.id)
      ? prev.map((a) => (a.id === attachment.id ? attachment : a))
      : [...prev, attachment],
  );
}

export function removeEntryAttachmentFromList(entryId: number, attachmentId: number): void {
  if (attachmentsEntryId() !== entryId) return;
  setEntryAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
}

/** Clears the list without asking a mounted strip to reload (entry closed). */
export function clearEntryAttachments(): void {
  loadToken++;
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
 * Untracked: whether the loaded list says `entryId` has attachments. The editor's
 * save-vs-delete decision uses it, because an entry with attachments is never blank —
 * the backend refuses to auto-delete it (TODO-0114), so a "blank" verdict would only
 * drop the user's cleared text or offer a hard delete of the attachments.
 */
export function entryHasLoadedAttachments(entryId: number): boolean {
  return untrack(() => attachmentsEntryId() === entryId && entryAttachments().length > 0);
}
