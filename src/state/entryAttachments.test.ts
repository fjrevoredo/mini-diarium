import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AttachmentSummary } from '../lib/tauri';

const mocks = vi.hoisted(() => ({ listEntryAttachments: vi.fn() }));
vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri');
  return { ...actual, listEntryAttachments: mocks.listEntryAttachments };
});

import {
  entryAttachments,
  attachmentsVersion,
  loadEntryAttachments,
  upsertEntryAttachment,
  removeEntryAttachmentFromList,
  resetEntryAttachmentsState,
  attachmentPresence,
  entryHasAttachments,
} from './entryAttachments';
import { isBlankEntry } from '../components/layout/editor-panel/useEntryPersistence';

const summary = (id: number, name: string): AttachmentSummary => ({
  id,
  name,
  mime_type: 'application/octet-stream',
  byte_size: 1,
  created_at: '2024-01-01T00:00:00Z',
});

describe('entryAttachments state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEntryAttachmentsState();
  });

  it('keeps only the latest load when two overlap', async () => {
    let resolveFirst!: (v: AttachmentSummary[]) => void;
    mocks.listEntryAttachments
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce([summary(2, 'second.txt')]);

    const first = loadEntryAttachments(1);
    await loadEntryAttachments(2);
    resolveFirst([summary(1, 'first.txt')]);
    await first;

    expect(entryAttachments().map((a) => a.name)).toEqual(['second.txt']);
    expect(attachmentPresence(2)).toBe('has');
    expect(attachmentPresence(1)).toBe('unknown');
  });

  it('upsert replaces a deduplicated attachment instead of adding it twice', async () => {
    mocks.listEntryAttachments.mockResolvedValue([summary(1, 'a.txt')]);
    await loadEntryAttachments(5);
    upsertEntryAttachment(5, summary(1, 'a.txt'));
    upsertEntryAttachment(5, summary(2, 'b.txt'));
    upsertEntryAttachment(6, summary(3, 'other-entry.txt'));
    expect(entryAttachments().map((a) => a.id)).toEqual([1, 2]);

    removeEntryAttachmentFromList(5, 1);
    expect(entryAttachments().map((a) => a.id)).toEqual([2]);
  });

  it('reset clears the list and bumps the reload version', async () => {
    mocks.listEntryAttachments.mockResolvedValue([summary(1, 'a.txt')]);
    await loadEntryAttachments(5);
    const before = attachmentsVersion();
    resetEntryAttachmentsState();
    expect(entryAttachments()).toEqual([]);
    expect(attachmentsVersion()).toBe(before + 1);
    expect(attachmentPresence(5)).toBe('unknown');
  });

  it('isBlankEntry: an entry with attachments is never blank', async () => {
    mocks.listEntryAttachments.mockResolvedValue([]);
    await loadEntryAttachments(5);
    expect(await isBlankEntry(5, '  ', true)).toBe(true);
    expect(await isBlankEntry(5, 'Title', true)).toBe(false);
    expect(await isBlankEntry(5, '', false)).toBe(false);

    mocks.listEntryAttachments.mockResolvedValue([summary(1, 'a.txt')]);
    await loadEntryAttachments(5);
    expect(await isBlankEntry(5, '', true)).toBe(false);
  });

  // Regression: the verdict for entry A must not come from whatever list is loaded. After
  // navigating to B, A's files are no longer in the list; reading "no attachments" from it
  // sent a cleared A down the delete paths (incl. the hard-delete consent prompt).
  it('isBlankEntry asks the backend when the loaded list belongs to another entry', async () => {
    mocks.listEntryAttachments.mockResolvedValueOnce([]); // entry 6 is loaded, and empty
    await loadEntryAttachments(6);
    mocks.listEntryAttachments.mockResolvedValueOnce([summary(1, 'a.txt')]); // backend for 5

    expect(await isBlankEntry(5, '', true)).toBe(false);
    expect(mocks.listEntryAttachments).toHaveBeenLastCalledWith(5);
  });

  it('isBlankEntry asks the backend while the list for the same entry is still loading', async () => {
    let resolveLoad!: (v: AttachmentSummary[]) => void;
    mocks.listEntryAttachments.mockImplementationOnce(() => new Promise((r) => (resolveLoad = r)));
    const loading = loadEntryAttachments(5);
    expect(attachmentPresence(5)).toBe('unknown');

    mocks.listEntryAttachments.mockResolvedValueOnce([summary(1, 'a.txt')]);
    expect(await isBlankEntry(5, '', true)).toBe(false);
    resolveLoad([summary(1, 'a.txt')]);
    await loading;
  });

  it('entryHasAttachments answers yes when the backend check fails', async () => {
    mocks.listEntryAttachments.mockRejectedValueOnce('Journal must be unlocked');
    expect(await entryHasAttachments(9)).toBe(true);
  });
});
