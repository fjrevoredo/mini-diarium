import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { loadAllTags, resetTagsState, activeTagFilter } from '../../state/tags';
import { setIsSidebarCollapsed } from '../../state/ui';
import type { Tag } from '../../lib/tauri';

const mocks = vi.hoisted(() => ({
  getAllTags: vi.fn(),
  getTagsForEntry: vi.fn(),
  getEntryDatesByTag: vi.fn(),
  addTagToEntry: vi.fn(),
  removeTagFromEntry: vi.fn(),
  createTag: vi.fn(),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    getAllTags: mocks.getAllTags,
    getTagsForEntry: mocks.getTagsForEntry,
    getEntryDatesByTag: mocks.getEntryDatesByTag,
    addTagToEntry: mocks.addTagToEntry,
    removeTagFromEntry: mocks.removeTagFromEntry,
    createTag: mocks.createTag,
  };
});

vi.mock('../../state/ui', () => ({
  setIsTagManagerOpen: vi.fn(),
  setIsSidebarCollapsed: vi.fn(),
}));

import EntryTags from './EntryTags';

const WORK_TAG: Tag = { id: 1, name: 'Work', created_at: '2026-01-01T00:00:00Z' };
const CAREER_TAG: Tag = { id: 1, name: 'Career', created_at: '2026-01-01T00:00:00Z' };

describe('EntryTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTagsState();
    mocks.getAllTags.mockResolvedValue([]);
    mocks.getTagsForEntry.mockResolvedValue([]);
    mocks.getEntryDatesByTag.mockResolvedValue([]);
  });

  it('displays entry tags on mount', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getTagsForEntry.mockResolvedValue([WORK_TAG]);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);

    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());
  });

  it('updates tag badge name after rename without changing entry', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getTagsForEntry.mockResolvedValue([WORK_TAG]);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());

    // Simulate TagManager calling loadAllTags() after renameTag()
    mocks.getAllTags.mockResolvedValue([CAREER_TAG]);
    await loadAllTags();

    // RED before fix: still 'Work'. GREEN after fix: shows 'Career'.
    await waitFor(() => expect(screen.getByText('Career')).toBeInTheDocument());
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });

  it('removes tag badge when tag is deleted and allTags refreshes', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getTagsForEntry.mockResolvedValue([WORK_TAG]);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    await waitFor(() => expect(screen.getByText('Work')).toBeInTheDocument());

    // Simulate tag deletion: allTags no longer contains the tag
    mocks.getAllTags.mockResolvedValue([]);
    await loadAllTags();

    // RED before fix: badge remains. GREEN after fix: badge disappears.
    await waitFor(() => expect(screen.queryByText('Work')).not.toBeInTheDocument());
  });

  const HOME_TAG: Tag = { id: 2, name: 'Home', created_at: '2026-01-01T00:00:00Z' };

  it('adds an existing tag from the dropdown', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG, HOME_TAG]);
    mocks.getTagsForEntry.mockResolvedValue([]);
    mocks.addTagToEntry.mockResolvedValue(undefined);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    // Let the on-mount getTagsForEntry load settle before interacting, so its
    // setEntryTagIds([]) cannot race past the add below.
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByRole('button', { name: '+ Add tag' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Home' }));

    expect(mocks.addTagToEntry).toHaveBeenCalledWith(1, 2);
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument());
  });

  it('creates a new tag and attaches it to the entry', async () => {
    mocks.getAllTags.mockResolvedValue([]);
    mocks.getTagsForEntry.mockResolvedValue([]);
    await loadAllTags();
    const created: Tag = { id: 5, name: 'Ideas', created_at: '2026-01-01T00:00:00Z' };
    mocks.createTag.mockResolvedValue(created);
    mocks.addTagToEntry.mockResolvedValue(undefined);
    mocks.getAllTags.mockResolvedValue([created]); // loadAllTags() after create

    renderWithI18n(() => <EntryTags entryId={1} />);
    await new Promise((r) => setTimeout(r, 0)); // settle initial load (see add-existing test)
    fireEvent.click(screen.getByRole('button', { name: '+ Add tag' }));
    fireEvent.input(await screen.findByPlaceholderText('New tag…'), {
      target: { value: 'Ideas' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Create "Ideas"' }));

    await waitFor(() => expect(mocks.createTag).toHaveBeenCalledWith('Ideas'));
    expect(mocks.addTagToEntry).toHaveBeenCalledWith(1, 5);
    await waitFor(() => expect(screen.getByText('Ideas')).toBeInTheDocument());
  });

  it('creates a tag when Enter is pressed in the input', async () => {
    mocks.getAllTags.mockResolvedValue([]);
    mocks.getTagsForEntry.mockResolvedValue([]);
    await loadAllTags();
    const created: Tag = { id: 6, name: 'Xyz', created_at: '2026-01-01T00:00:00Z' };
    mocks.createTag.mockResolvedValue(created);
    mocks.addTagToEntry.mockResolvedValue(undefined);
    mocks.getAllTags.mockResolvedValue([created]);

    renderWithI18n(() => <EntryTags entryId={1} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add tag' }));
    const input = await screen.findByPlaceholderText('New tag…');
    fireEvent.input(input, { target: { value: 'Xyz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mocks.createTag).toHaveBeenCalledWith('Xyz'));
  });

  it('removes a tag from the entry', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getTagsForEntry.mockResolvedValue([WORK_TAG]);
    mocks.removeTagFromEntry.mockResolvedValue(undefined);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    await screen.findByText('Work');

    fireEvent.click(screen.getByRole('button', { name: 'Remove tag Work' }));

    expect(mocks.removeTagFromEntry).toHaveBeenCalledWith(1, 1);
    await waitFor(() => expect(screen.queryByText('Work')).not.toBeInTheDocument());
  });

  it('closes the dropdown and clears the input on Escape', async () => {
    mocks.getAllTags.mockResolvedValue([]);
    mocks.getTagsForEntry.mockResolvedValue([]);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add tag' }));
    const input = await screen.findByPlaceholderText('New tag…');
    fireEvent.input(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByPlaceholderText('New tag…')).not.toBeInTheDocument());
  });

  it('closes the dropdown when clicking outside (mousedown listener)', async () => {
    mocks.getAllTags.mockResolvedValue([]);
    mocks.getTagsForEntry.mockResolvedValue([]);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add tag' }));
    await screen.findByPlaceholderText('New tag…');

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByPlaceholderText('New tag…')).not.toBeInTheDocument());
  });

  it('toggles the tag filter and expands the sidebar when a tag badge is clicked', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getTagsForEntry.mockResolvedValue([WORK_TAG]);
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await loadAllTags();

    renderWithI18n(() => <EntryTags entryId={1} />);
    await screen.findByText('Work');

    fireEvent.click(screen.getByRole('button', { name: 'Work' }));

    await waitFor(() => expect(activeTagFilter()?.id).toBe(1));
    expect(setIsSidebarCollapsed).toHaveBeenCalledWith(false);
  });

  it('renders a sanitized error (no path leak) when loading entry tags fails', async () => {
    mocks.getAllTags.mockResolvedValue([]);
    mocks.getTagsForEntry.mockRejectedValue('failed to read /secret/path/diary.db');
    await loadAllTags();

    const { container } = renderWithI18n(() => <EntryTags entryId={1} />);

    await waitFor(() => {
      const err = container.querySelector('.text-error');
      expect(err).toBeInTheDocument();
      expect(err?.textContent).not.toContain('/secret/path');
    });
  });
});
