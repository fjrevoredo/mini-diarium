import { invoke } from '@tauri-apps/api/core';

// Attachment commands (TODO-0114). Only ids, paths, and metadata cross IPC — the file
// bytes are read, encrypted, decrypted, and written entirely in Rust.
export interface AttachmentSummary {
  id: number;
  /** Per-entry file name (basename only). */
  name: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
}

export async function listEntryAttachments(entryId: number): Promise<AttachmentSummary[]> {
  return await invoke('list_entry_attachments', { entryId });
}

/** Encrypts the file at `path` into the journal and links it to the entry. */
export async function addEntryAttachment(
  entryId: number,
  path: string,
): Promise<AttachmentSummary> {
  return await invoke('add_entry_attachment', { entryId, path });
}

export async function removeEntryAttachment(entryId: number, attachmentId: number): Promise<void> {
  await invoke('remove_entry_attachment', { entryId, attachmentId });
}

/** Decrypts the attachment straight to `destPath`; the extension must match the stored name. */
export async function saveAttachmentCopy(
  entryId: number,
  attachmentId: number,
  destPath: string,
): Promise<void> {
  await invoke('save_attachment_copy', { entryId, attachmentId, destPath });
}
