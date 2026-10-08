import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { setEntryDates, registerNavigationGuard } from '../../state/entries';
import { selectedDate, selectedEntryId, mainView, setMainView, resetUiState } from '../../state/ui';
import { setPreferences } from '../../state/preferences';
import { activeTagFilter, loadAllTags, resetTagsState, setTagFilter } from '../../state/tags';
import type { Tag, TimelineEntry } from '../../lib/tauri';
import { makeTimelineEntry } from '../../test/fixtures';

const mocks = vi.hoisted(() => ({
  getTimelineEntries: vi.fn(),
  getAllTags: vi.fn(),
  getEntryDatesByTag: vi.fn(),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    getTimelineEntries: mocks.getTimelineEntries,
    getAllTags: mocks.getAllTags,
    getEntryDatesByTag: mocks.getEntryDatesByTag,
  };
});

import Timeline from './Timeline';

const ENTRIES: TimelineEntry[] = [
  makeTimelineEntry({ id: 2, date: '2026-02-01', title: 'Second entry', preview: 'A later day' }),
  makeTimelineEntry({ id: 1, date: '2026-01-01', title: 'First entry', preview: 'The beginning' }),
];

const WORK: Tag = { id: 10, name: 'Work', created_at: '2026-01-01T00:00:00Z' };
const TRAVEL: Tag = { id: 11, name: 'Travel', created_at: '2026-01-01T00:00:00Z' };

// Two entries on the same day, only one tagged: the filter must work per entry, not per date.
const TAGGED_ENTRIES: TimelineEntry[] = [
  makeTimelineEntry({ id: 3, date: '2026-03-01', title: 'Work trip', tag_ids: [10, 11] }),
  makeTimelineEntry({ id: 2, date: '2026-03-01', title: 'Untagged sibling', tag_ids: [] }),
  makeTimelineEntry({ id: 1, date: '2026-02-01', title: 'Holiday', tag_ids: [11] }),
];

describe('Timeline', () => {
  beforeEach(() => {
    mocks.getTimelineEntries.mockReset();
    mocks.getAllTags.mockReset();
    mocks.getEntryDatesByTag.mockReset();
    mocks.getEntryDatesByTag.mockResolvedValue([]);
    setEntryDates(['2026-01-01', '2026-02-01']);
    resetUiState();
    resetTagsState();
    // Preference state is module-global and persisted, so leakage between tests is real.
    setPreferences({
      timelineDateFormat: 'full',
      showTimelinePreview: true,
      showTimelineTags: false,
      language: 'en',
    });
  });

  it('renders the list of entries', async () => {
    mocks.getTimelineEntries.mockResolvedValue(ENTRIES);

    renderWithI18n(() => <Timeline />);

    await waitFor(() => {
      expect(screen.getByText('Second entry')).toBeInTheDocument();
    });
    expect(screen.getByText('First entry')).toBeInTheDocument();
    expect(screen.getByText('A later day')).toBeInTheDocument();
    expect(screen.getByText('The beginning')).toBeInTheDocument();
  });

  it('renders the empty state when there are no entries', async () => {
    mocks.getTimelineEntries.mockResolvedValue([]);

    renderWithI18n(() => <Timeline />);

    await waitFor(() => {
      expect(screen.getByText('No entries yet.')).toBeInTheDocument();
    });
  });

  it('clicking an entry navigates to it in the editor', async () => {
    mocks.getTimelineEntries.mockResolvedValue([
      { id: 1, date: '2026-03-15', title: 'Test', preview: 'Preview text' },
    ]);
    setMainView('timeline');
    renderWithI18n(() => <Timeline />);
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
    screen.getByRole('button').click();
    await waitFor(() => expect(selectedDate()).toBe('2026-03-15'));
    expect(mainView()).toBe('editor');
  });

  // ── TODO-0104: guarded navigation ──

  it('openEntry calls requestNavigationConsent exactly once for the combined date+view change', async () => {
    const guard = vi.fn(async () => true);
    const unregister = registerNavigationGuard(guard);
    try {
      mocks.getTimelineEntries.mockResolvedValue([
        { id: 1, date: '2026-03-15', title: 'Test', preview: 'Preview text' },
      ]);
      setMainView('timeline');
      renderWithI18n(() => <Timeline />);
      await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());

      screen.getByRole('button').click();

      await waitFor(() => expect(selectedDate()).toBe('2026-03-15'));
      expect(guard).toHaveBeenCalledTimes(1);
      expect(mainView()).toBe('editor');
    } finally {
      unregister();
    }
  });

  it('a denying guard leaves selectedDate and mainView unchanged', async () => {
    const unregister = registerNavigationGuard(async () => false);
    try {
      mocks.getTimelineEntries.mockResolvedValue([
        { id: 1, date: '2026-03-15', title: 'Test', preview: 'Preview text' },
      ]);
      setMainView('timeline');
      const before = selectedDate();
      renderWithI18n(() => <Timeline />);
      await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());

      screen.getByRole('button').click();
      await Promise.resolve();

      expect(selectedDate()).toBe(before);
      expect(mainView()).toBe('timeline');
    } finally {
      unregister();
    }
  });

  it('shows Untitled for entries with empty title', async () => {
    mocks.getTimelineEntries.mockResolvedValue([
      { id: 1, date: '2026-01-01', title: '', preview: '' },
    ]);
    renderWithI18n(() => <Timeline />);
    await waitFor(() => {
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  it('renders the full date by default', async () => {
    mocks.getTimelineEntries.mockResolvedValue(ENTRIES);

    renderWithI18n(() => <Timeline />);

    await waitFor(() => {
      expect(screen.getByText('Thursday, January 1, 2026')).toBeInTheDocument();
    });
  });

  it('renders the plain stored date when the ISO style is selected', async () => {
    mocks.getTimelineEntries.mockResolvedValue(ENTRIES);
    setPreferences({ timelineDateFormat: 'iso' });

    renderWithI18n(() => <Timeline />);

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument();
    });
    expect(screen.queryByText('Thursday, January 1, 2026')).not.toBeInTheDocument();
  });

  it('keeps the full date in the aria-label even under the ISO style', async () => {
    mocks.getTimelineEntries.mockResolvedValue(ENTRIES);
    setPreferences({ timelineDateFormat: 'iso' });

    renderWithI18n(() => <Timeline />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Open entry from Thursday, January 1, 2026/ }),
      ).toBeInTheDocument();
    });
  });

  it('hides the preview but keeps the title when showTimelinePreview is off', async () => {
    mocks.getTimelineEntries.mockResolvedValue(ENTRIES);
    setPreferences({ showTimelinePreview: false });

    renderWithI18n(() => <Timeline />);

    await waitFor(() => {
      expect(screen.getByText('First entry')).toBeInTheDocument();
    });
    expect(screen.queryByText('The beginning')).not.toBeInTheDocument();
  });

  it('renders a passive lock indicator only for locked entries', async () => {
    mocks.getTimelineEntries.mockResolvedValue([
      { id: 2, date: '2026-02-01', title: 'Locked one', preview: 'x', locked: true },
      { id: 1, date: '2026-01-01', title: 'Open one', preview: 'y', locked: false },
    ]);
    renderWithI18n(() => <Timeline />);
    await waitFor(() => {
      expect(screen.getByText('Locked one')).toBeInTheDocument();
    });
    const indicators = screen.getAllByTestId('timeline-lock-indicator');
    expect(indicators).toHaveLength(1);
    // The indicator is a non-interactive badge, not a button.
    expect(indicators[0].tagName).not.toBe('BUTTON');
  });

  // ── TODO-0124: tag filter, tag chips, exact-entry deep-link ──

  it('opening a row deep-links the clicked entry, not the day', async () => {
    mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);
    setMainView('timeline');
    renderWithI18n(() => <Timeline />);
    await waitFor(() => expect(screen.getByText('Untagged sibling')).toBeInTheDocument());

    screen.getByText('Untagged sibling').click();

    await waitFor(() => expect(mainView()).toBe('editor'));
    expect(selectedEntryId()).toBe(2);
    expect(selectedDate()).toBe('2026-03-01');
  });

  it('a denying guard leaves no stale deep-link behind', async () => {
    const unregister = registerNavigationGuard(async () => false);
    try {
      mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);
      setMainView('timeline');
      renderWithI18n(() => <Timeline />);
      await waitFor(() => expect(screen.getByText('Holiday')).toBeInTheDocument());

      screen.getByText('Holiday').click();

      await waitFor(() => expect(selectedEntryId()).toBeNull());
      expect(mainView()).toBe('timeline');
    } finally {
      unregister();
    }
  });

  it('an active tag filter hides the untagged sibling on the same day', async () => {
    mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);
    await setTagFilter(WORK);

    renderWithI18n(() => <Timeline />);

    await waitFor(() => expect(screen.getByText('Work trip')).toBeInTheDocument());
    expect(screen.queryByText('Untagged sibling')).not.toBeInTheDocument();
    expect(screen.queryByText('Holiday')).not.toBeInTheDocument();
  });

  it('shows the filter banner with the tag name, and clearing it restores the full list', async () => {
    mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);
    await setTagFilter(TRAVEL);

    renderWithI18n(() => <Timeline />);

    const banner = await screen.findByTestId('timeline-tag-filter-banner');
    expect(banner).toHaveTextContent('Tag filter: Travel');
    expect(screen.queryByText('Untagged sibling')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Clear tag filter' }).click();

    await waitFor(() => expect(screen.getByText('Untagged sibling')).toBeInTheDocument());
    expect(activeTagFilter()).toBeNull();
    expect(screen.queryByTestId('timeline-tag-filter-banner')).not.toBeInTheDocument();
  });

  it('shows a tag-specific empty message when no entry has the filtered tag', async () => {
    mocks.getTimelineEntries.mockResolvedValue(ENTRIES);
    await setTagFilter(WORK);

    renderWithI18n(() => <Timeline />);

    await waitFor(() =>
      expect(screen.getByText('No entries with the tag "Work".')).toBeInTheDocument(),
    );
    expect(screen.queryByText('No entries yet.')).not.toBeInTheDocument();
  });

  it('does not render tag chips while the preference is off', async () => {
    mocks.getAllTags.mockResolvedValue([TRAVEL, WORK]);
    await loadAllTags();
    mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);

    renderWithI18n(() => <Timeline />);

    await waitFor(() => expect(screen.getByText('Work trip')).toBeInTheDocument());
    expect(screen.queryByTestId('timeline-tag-chip')).not.toBeInTheDocument();
  });

  it('renders the tags of each entry as chips when the preference is on', async () => {
    mocks.getAllTags.mockResolvedValue([TRAVEL, WORK]);
    await loadAllTags();
    mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);
    setPreferences({ showTimelineTags: true });

    renderWithI18n(() => <Timeline />);

    await waitFor(() => expect(screen.getByText('Work trip')).toBeInTheDocument());
    const chips = screen.getAllByTestId('timeline-tag-chip');
    // "Work trip" carries Travel + Work (name order), "Holiday" carries Travel, the sibling none.
    expect(chips.map((c) => c.textContent)).toEqual(['Travel', 'Work', 'Travel']);
  });

  it('clicking a chip sets the filter, and clicking it again clears it', async () => {
    mocks.getAllTags.mockResolvedValue([TRAVEL, WORK]);
    await loadAllTags();
    mocks.getTimelineEntries.mockResolvedValue(TAGGED_ENTRIES);
    setPreferences({ showTimelineTags: true });

    renderWithI18n(() => <Timeline />);
    await waitFor(() => expect(screen.getByText('Work trip')).toBeInTheDocument());

    const workChip = screen
      .getAllByTestId('timeline-tag-chip')
      .find((c) => c.textContent === 'Work')!;
    expect(workChip).toHaveAttribute('title', 'Filter by tag');
    workChip.click();

    await waitFor(() => expect(activeTagFilter()?.id).toBe(WORK.id));
    expect(mocks.getEntryDatesByTag).toHaveBeenCalledWith(WORK.id);
    // A chip click does not open the entry.
    expect(selectedEntryId()).toBeNull();
    await waitFor(() => expect(screen.queryByText('Holiday')).not.toBeInTheDocument());

    const activeChip = screen
      .getAllByTestId('timeline-tag-chip')
      .find((c) => c.textContent === 'Work')!;
    expect(activeChip).toHaveAttribute('title', 'Clear tag filter');
    activeChip.click();

    await waitFor(() => expect(activeTagFilter()).toBeNull());
    await waitFor(() => expect(screen.getByText('Holiday')).toBeInTheDocument());
  });
});
