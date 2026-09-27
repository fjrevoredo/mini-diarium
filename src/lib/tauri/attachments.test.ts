import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  listEntryAttachments,
  addEntryAttachment,
  removeEntryAttachment,
  saveAttachmentCopy,
  type AttachmentSummary,
} from './attachments';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const SUMMARY: AttachmentSummary = {
  id: 3,
  name: 'Report.pdf',
  mime_type: 'application/pdf',
  byte_size: 1024,
  created_at: '2024-01-01T00:00:00Z',
};

describe('attachment command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listEntryAttachments → list_entry_attachments { entryId }', async () => {
    mockInvoke.mockResolvedValue([SUMMARY]);
    await expect(listEntryAttachments(7)).resolves.toEqual([SUMMARY]);
    expect(mockInvoke).toHaveBeenCalledWith('list_entry_attachments', { entryId: 7 });
  });

  it('addEntryAttachment → add_entry_attachment { entryId, path } and returns the summary', async () => {
    mockInvoke.mockResolvedValue(SUMMARY);
    await expect(addEntryAttachment(7, 'C:/docs/Report.pdf')).resolves.toEqual(SUMMARY);
    expect(mockInvoke).toHaveBeenCalledWith('add_entry_attachment', {
      entryId: 7,
      path: 'C:/docs/Report.pdf',
    });
  });

  it('removeEntryAttachment → remove_entry_attachment { entryId, attachmentId }', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await removeEntryAttachment(7, 3);
    expect(mockInvoke).toHaveBeenCalledWith('remove_entry_attachment', {
      entryId: 7,
      attachmentId: 3,
    });
  });

  it('saveAttachmentCopy → save_attachment_copy { entryId, attachmentId, destPath }', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await saveAttachmentCopy(7, 3, 'C:/out/Report.pdf');
    expect(mockInvoke).toHaveBeenCalledWith('save_attachment_copy', {
      entryId: 7,
      attachmentId: 3,
      destPath: 'C:/out/Report.pdf',
    });
  });

  it('propagates a backend rejection', async () => {
    mockInvoke.mockRejectedValue('entry is locked');
    await expect(removeEntryAttachment(7, 3)).rejects.toBe('entry is locked');
  });
});
