import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { resetEntryAttachmentsState, attachmentPresence } from '../../state/entryAttachments';
import type { AttachmentSummary } from '../../lib/tauri';

const mocks = vi.hoisted(() => ({
  listEntryAttachments: vi.fn(),
  addEntryAttachment: vi.fn(),
  removeEntryAttachment: vi.fn(),
  saveAttachmentCopy: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  confirmInApp: vi.fn(),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    listEntryAttachments: mocks.listEntryAttachments,
    addEntryAttachment: mocks.addEntryAttachment,
    removeEntryAttachment: mocks.removeEntryAttachment,
    saveAttachmentCopy: mocks.saveAttachmentCopy,
  };
});

vi.mock('../../lib/dialog', () => ({ open: mocks.open, save: mocks.save }));
vi.mock('../../state/confirm-dialog', () => ({ confirmInApp: mocks.confirmInApp }));

import EntryAttachments, { fileExtension } from './EntryAttachments';

const PDF: AttachmentSummary = {
  id: 3,
  name: 'Report.pdf',
  mime_type: 'application/pdf',
  byte_size: 2048,
  created_at: '2024-01-01T00:00:00Z',
};
const CLIP: AttachmentSummary = {
  id: 4,
  name: 'clip.mp4',
  mime_type: 'video/mp4',
  byte_size: 100,
  created_at: '2024-01-01T00:00:01Z',
};

describe('EntryAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEntryAttachmentsState();
    mocks.listEntryAttachments.mockResolvedValue([PDF]);
  });

  it('loads and shows the entry attachments with their sizes', async () => {
    renderWithI18n(() => <EntryAttachments entryId={1} />);
    await waitFor(() => expect(screen.getByText('Report.pdf')).toBeInTheDocument());
    expect(mocks.listEntryAttachments).toHaveBeenCalledWith(1);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(attachmentPresence(1)).toBe('has');
    expect(attachmentPresence(2)).toBe('unknown');
  });

  it('adds every picked file and reports per-file failures without dropping the others', async () => {
    mocks.listEntryAttachments.mockResolvedValue([]);
    mocks.open.mockResolvedValue(['C:\\docs\\Report.pdf', 'C:\\docs\\huge.mov', '/tmp/clip.mp4']);
    mocks.addEntryAttachment
      .mockResolvedValueOnce(PDF)
      .mockRejectedValueOnce('Attachment is too large. Maximum supported size is 20 MB.')
      .mockResolvedValueOnce(CLIP);

    renderWithI18n(() => <EntryAttachments entryId={1} />);
    fireEvent.click(screen.getByTestId('entry-attachment-add-button'));

    await waitFor(() => expect(screen.getByText('clip.mp4')).toBeInTheDocument());
    expect(screen.getByText('Report.pdf')).toBeInTheDocument();
    expect(mocks.addEntryAttachment).toHaveBeenCalledTimes(3);
    expect(mocks.addEntryAttachment).toHaveBeenNthCalledWith(2, 1, 'C:\\docs\\huge.mov');
    expect(screen.getByRole('alert').textContent).toBe(
      'Could not attach "huge.mov": This file is too large. Attachments can be up to 20 MB.',
    );
  });

  // Regression guard: entry ids repeat across journals. A multi-file add that outlives a
  // lock + journal switch would otherwise attach the remaining files to an unrelated entry.
  it('stops a multi-file add when the session resets mid-way', async () => {
    mocks.listEntryAttachments.mockResolvedValue([]);
    mocks.open.mockResolvedValue(['C:\\docs\\Report.pdf', '/tmp/clip.mp4']);
    mocks.addEntryAttachment.mockImplementationOnce(async () => {
      resetEntryAttachmentsState(); // the journal locks while the first file is added
      return PDF;
    });

    renderWithI18n(() => <EntryAttachments entryId={1} />);
    fireEvent.click(screen.getByTestId('entry-attachment-add-button'));

    await waitFor(() => expect(mocks.addEntryAttachment).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('entry-attachment-add-button')).not.toBeDisabled(),
    );
    expect(mocks.addEntryAttachment).toHaveBeenCalledTimes(1);
  });

  it('does not save a copy when the session resets while the save dialog is open', async () => {
    mocks.save.mockImplementationOnce(async () => {
      resetEntryAttachmentsState();
      return 'C:\\out\\Report.pdf';
    });
    renderWithI18n(() => <EntryAttachments entryId={1} />);
    await waitFor(() => expect(screen.getByText('Report.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('entry-attachment-save-button'));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    await Promise.resolve();
    expect(mocks.saveAttachmentCopy).not.toHaveBeenCalled();
  });

  it('does nothing when the file dialog is cancelled', async () => {
    mocks.open.mockResolvedValue(null);
    renderWithI18n(() => <EntryAttachments entryId={1} />);
    fireEvent.click(screen.getByTestId('entry-attachment-add-button'));
    await waitFor(() => expect(mocks.open).toHaveBeenCalled());
    expect(mocks.addEntryAttachment).not.toHaveBeenCalled();
  });

  it('removes an attachment only after confirmation', async () => {
    mocks.confirmInApp.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mocks.removeEntryAttachment.mockResolvedValue(undefined);
    renderWithI18n(() => <EntryAttachments entryId={1} />);
    await waitFor(() => expect(screen.getByText('Report.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('entry-attachment-remove-button'));
    await waitFor(() => expect(mocks.confirmInApp).toHaveBeenCalledTimes(1));
    expect(mocks.removeEntryAttachment).not.toHaveBeenCalled();
    expect(mocks.confirmInApp.mock.calls[0][0]).toBe('Remove "Report.pdf" from this entry?');
    // The shared dialog defaults to "Delete entry"; removing a file must not say that.
    expect(mocks.confirmInApp.mock.calls[0][1]).toMatchObject({ confirmLabel: 'Remove' });

    fireEvent.click(screen.getByTestId('entry-attachment-remove-button'));
    await waitFor(() => expect(mocks.removeEntryAttachment).toHaveBeenCalledWith(1, 3));
    await waitFor(() => expect(screen.queryByText('Report.pdf')).not.toBeInTheDocument());
  });

  it('warns about inline references when the editor contains one', async () => {
    mocks.confirmInApp.mockResolvedValue(false);
    const editor = {
      isDestroyed: false,
      getHTML: () => '<p><span data-attachment-ref="3"></span></p>',
    } as unknown as import('@tiptap/core').Editor;
    renderWithI18n(() => <EntryAttachments entryId={1} editor={editor} />);
    await waitFor(() => expect(screen.getByText('Report.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('entry-attachment-remove-button'));
    await waitFor(() => expect(mocks.confirmInApp).toHaveBeenCalled());
    expect(mocks.confirmInApp.mock.calls[0][0]).toContain('will show as missing');
  });

  it('saves a copy to the chosen path with an extension filter', async () => {
    mocks.save.mockResolvedValue('C:\\out\\Report.pdf');
    mocks.saveAttachmentCopy.mockResolvedValue(undefined);
    renderWithI18n(() => <EntryAttachments entryId={1} />);
    await waitFor(() => expect(screen.getByText('Report.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('entry-attachment-save-button'));
    await waitFor(() =>
      expect(mocks.saveAttachmentCopy).toHaveBeenCalledWith(1, 3, 'C:\\out\\Report.pdf'),
    );
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: 'Report.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
  });

  it('locked: hides add, remove, and insert, but keeps Save a copy', async () => {
    const editor = {
      isDestroyed: false,
      getHTML: () => '',
    } as unknown as import('@tiptap/core').Editor;
    renderWithI18n(() => <EntryAttachments entryId={1} locked editor={editor} />);
    await waitFor(() => expect(screen.getByText('Report.pdf')).toBeInTheDocument());

    expect(screen.queryByTestId('entry-attachment-add-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('entry-attachment-remove-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('entry-attachment-insert-ref-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('entry-attachment-save-button')).toBeInTheDocument();
  });

  it('shows a mapped error when loading fails', async () => {
    mocks.listEntryAttachments.mockRejectedValue('Journal must be unlocked');
    renderWithI18n(() => <EntryAttachments entryId={1} />);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Please unlock your journal first.'),
    );
  });
});

describe('fileExtension', () => {
  it('returns the lower-case extension or null', () => {
    expect(fileExtension('Report.PDF')).toBe('pdf');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
    expect(fileExtension('README')).toBeNull();
    expect(fileExtension('.bashrc')).toBeNull();
    expect(fileExtension('trailing.')).toBeNull();
  });
});
