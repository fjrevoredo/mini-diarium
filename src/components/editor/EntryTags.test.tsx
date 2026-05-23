import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { loadAllTags, resetTagsState } from '../../state/tags';
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
});
