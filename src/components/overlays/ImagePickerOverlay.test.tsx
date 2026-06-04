import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const summary = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  mime_type: 'image/png',
  created_at: '2026-06-04T10:15:00Z',
  thumbnail_mime_type: null,
  thumbnail_data_base64: null,
  width: 320,
  height: 180,
  byte_size: 2048,
  usage_count: 2,
  first_entry_date: '2026-06-01',
  latest_entry_date: '2026-06-03',
  ...overrides,
});

beforeEach(() => {
  mockListJournalImageSummaries.mockReset();
  mockGetImageData.mockReset();
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1024,
  });
  window.dispatchEvent(new Event('resize'));
});

describe('ImagePickerOverlay', () => {
  it('renders the empty state when no saved image summaries exist', async () => {
    mockListJournalImageSummaries.mockResolvedValue({ items: [], has_more: false });

    renderWithI18n(() => <ImagePickerOverlay onInsert={() => {}} onClose={() => {}} />);

    expect(
      await screen.findByText('No saved images yet. Insert an image to save it here.'),
    ).toBeTruthy();
  });

  it('selects on first click without inserting', async () => {
    mockListJournalImageSummaries.mockResolvedValue({
      items: [summary(7)],
      has_more: false,
    });

    const onInsert = vi.fn();
    renderWithI18n(() => <ImagePickerOverlay onInsert={onInsert} onClose={() => {}} />);

    const tile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    fireEvent.click(tile);

    expect(onInsert).not.toHaveBeenCalled();
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Insert' })).toBeEnabled();
    expect(screen.getByText('320 × 180')).toBeTruthy();
    expect(screen.getByText('2026-06-01 to 2026-06-03')).toBeTruthy();
  });

  it('double click inserts the selected image', async () => {
    mockListJournalImageSummaries.mockResolvedValue({
      items: [summary(7)],
      has_more: false,
    });
    mockGetImageData.mockResolvedValue({
      id: 7,
      mime_type: 'image/png',
      data_base64: 'abc123',
    });

    const onInsert = vi.fn();
    const onClose = vi.fn();
    renderWithI18n(() => <ImagePickerOverlay onInsert={onInsert} onClose={onClose} />);

    const tile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    fireEvent.doubleClick(tile);

    await waitFor(() => {
      expect(mockGetImageData).toHaveBeenCalledWith(7);
      expect(onInsert).toHaveBeenCalledWith('data:image/png;base64,abc123');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('insert button inserts the current selection', async () => {
    mockListJournalImageSummaries.mockResolvedValue({
      items: [summary(5)],
      has_more: false,
    });
    mockGetImageData.mockResolvedValue({
      id: 5,
      mime_type: 'image/png',
      data_base64: 'xyz789',
    });

    const onInsert = vi.fn();
    renderWithI18n(() => <ImagePickerOverlay onInsert={onInsert} onClose={() => {}} />);

    const tile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    fireEvent.click(tile);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith('data:image/png;base64,xyz789');
    });
  });

  it('keeps the dialog open and shows an error when insert fails', async () => {
    mockListJournalImageSummaries.mockResolvedValue({
      items: [summary(9)],
      has_more: false,
    });
    mockGetImageData.mockRejectedValue(new Error('boom'));

    const onClose = vi.fn();
    renderWithI18n(() => <ImagePickerOverlay onInsert={() => {}} onClose={onClose} />);

    const tile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    fireEvent.click(tile);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));

    expect(await screen.findByText('Failed to insert image.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes exactly once on Escape', async () => {
    mockListJournalImageSummaries.mockResolvedValue({ items: [summary(4)], has_more: false });

    const onClose = vi.fn();
    renderWithI18n(() => <ImagePickerOverlay onInsert={() => {}} onClose={onClose} />);

    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close while an insert request is still in flight', async () => {
    mockListJournalImageSummaries.mockResolvedValue({ items: [summary(8)], has_more: false });

    let resolveImage!: (value: { id: number; mime_type: string; data_base64: string }) => void;
    mockGetImageData.mockImplementation(
      () =>
        new Promise<{ id: number; mime_type: string; data_base64: string }>((resolve) => {
          resolveImage = resolve;
        }),
    );

    const onInsert = vi.fn();
    const onClose = vi.fn();
    renderWithI18n(() => <ImagePickerOverlay onInsert={onInsert} onClose={onClose} />);

    const tile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    fireEvent.click(tile);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));

    await waitFor(() => {
      expect(mockGetImageData).toHaveBeenCalledWith(8);
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveImage({ id: 8, mime_type: 'image/png', data_base64: 'pending' });

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith('data:image/png;base64,pending');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('loads more results without losing the current selection', async () => {
    mockListJournalImageSummaries
      .mockResolvedValueOnce({
        items: [summary(1), summary(2, { mime_type: 'image/jpeg' })],
        has_more: true,
      })
      .mockResolvedValueOnce({
        items: [summary(3, { mime_type: 'image/gif' })],
        has_more: false,
      });

    renderWithI18n(() => <ImagePickerOverlay onInsert={() => {}} onClose={() => {}} />);

    const pngTile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    fireEvent.click(pngTile);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    const gifTile = (await screen.findByText('GIF')).closest('button') as HTMLButtonElement;
    expect(gifTile).toBeTruthy();
    expect(pngTile.getAttribute('aria-pressed')).toBe('true');
  });

  it('re-queries when sort and month filters change', async () => {
    mockListJournalImageSummaries.mockResolvedValue({ items: [summary(1)], has_more: false });

    renderWithI18n(() => <ImagePickerOverlay onInsert={() => {}} onClose={() => {}} />);

    await waitFor(() => {
      expect(mockListJournalImageSummaries).toHaveBeenCalledWith({
        limit: 24,
        offset: 0,
        sort: 'newest',
        month: null,
      });
    });

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'most_used' } });
    fireEvent.input(screen.getByLabelText('Month'), { target: { value: '2026-06' } });

    await waitFor(() => {
      expect(mockListJournalImageSummaries).toHaveBeenLastCalledWith({
        limit: 24,
        offset: 0,
        sort: 'most_used',
        month: '2026-06',
      });
    });
  });

  it('renders the mobile library and preview flow below the lg breakpoint', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    mockListJournalImageSummaries.mockResolvedValue({
      items: [summary(7)],
      has_more: false,
    });

    renderWithI18n(() => <ImagePickerOverlay onInsert={() => {}} onClose={() => {}} />);

    const tile = (await screen.findByText('PNG')).closest('button') as HTMLButtonElement;
    expect(screen.getAllByText('Preview')).toHaveLength(1);
    expect(screen.queryByText('320 × 180')).toBeNull();

    fireEvent.click(tile);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('320 × 180')).toBeTruthy();
    expect(screen.queryByText('PNG')).toBeNull();
    expect(screen.getByRole('button', { name: 'Insert' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));

    expect(await screen.findByText('PNG')).toBeTruthy();
    expect(screen.queryByText('320 × 180')).toBeNull();
  });
});
