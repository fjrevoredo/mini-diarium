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
  entryHasLoadedAttachments,
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
    expect(entryHasLoadedAttachments(2)).toBe(true);
    expect(entryHasLoadedAttachments(1)).toBe(false);
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
    expect(entryHasLoadedAttachments(5)).toBe(false);
  });

  it('isBlankEntry: an entry with attachments is never blank', async () => {
    expect(isBlankEntry(5, '  ', true)).toBe(true);
    mocks.listEntryAttachments.mockResolvedValue([summary(1, 'a.txt')]);
    await loadEntryAttachments(5);
    expect(isBlankEntry(5, '', true)).toBe(false);
    expect(isBlankEntry(6, '', true)).toBe(true);
    expect(isBlankEntry(6, 'Title', true)).toBe(false);
  });
});
