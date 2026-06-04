import { fireEvent, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../test/i18n-test-utils';
import ImagePickerOverlay from './ImagePickerOverlay';

const { mockListJournalImageSummaries, mockGetImageData } = vi.hoisted(() => ({
  mockListJournalImageSummaries: vi.fn(),
  mockGetImageData: vi.fn(),
}));

vi.mock('../../lib/tauri', () => ({
  listJournalImageSummaries: mockListJournalImageSummaries,
  getImageData: mockGetImageData,
}));

beforeEach(() => {
  mockListJournalImageSummaries.mockReset();
  mockGetImageData.mockReset();
});

describe('ImagePickerOverlay', () => {
  it('uses the standard opaque dialog surface styling', async () => {
    mockListJournalImageSummaries.mockResolvedValue([]);

    const { getByRole } = renderWithI18n(() => (
      <ImagePickerOverlay onInsert={() => {}} onClose={() => {}} />
    ));

    const dialog = getByRole('dialog');
    expect(dialog.className).toContain('bg-primary');
    expect(dialog.getAttribute('style')).toContain('var(--shadow-lg)');
  });

  it('renders the empty state when no saved image summaries exist', async () => {
    mockListJournalImageSummaries.mockResolvedValue([]);

    const { findByText } = renderWithI18n(() => (
      <ImagePickerOverlay onInsert={() => {}} onClose={() => {}} />
    ));

    expect(await findByText('No saved images yet. Insert an image to save it here.')).toBeTruthy();
  });

  it('loads image data on demand when a summary is selected', async () => {
    mockListJournalImageSummaries.mockResolvedValue([
      { id: 7, mime_type: 'image/png', created_at: '2026-06-04T10:15:00Z' },
    ]);
    mockGetImageData.mockResolvedValue({
      id: 7,
      mime_type: 'image/png',
      data_base64: 'abc123',
    });

    const onInsert = vi.fn();
    const onClose = vi.fn();
    const { findByText } = renderWithI18n(() => (
      <ImagePickerOverlay onInsert={onInsert} onClose={onClose} />
    ));

    const button = (await findByText('image/png')).closest('button') as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGetImageData).toHaveBeenCalledWith(7);
      expect(onInsert).toHaveBeenCalledWith('data:image/png;base64,abc123');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
