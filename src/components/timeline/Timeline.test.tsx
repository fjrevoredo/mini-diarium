import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { setEntryDates } from '../../state/entries';
import { selectedDate, mainView, setMainView, resetUiState } from '../../state/ui';
import type { TimelineEntry } from '../../lib/tauri';

const mocks = vi.hoisted(() => ({
  getTimelineEntries: vi.fn(),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    getTimelineEntries: mocks.getTimelineEntries,
  };
});

import Timeline from './Timeline';

const ENTRIES: TimelineEntry[] = [
  { id: 2, date: '2026-02-01', title: 'Second entry', preview: 'A later day' },
  { id: 1, date: '2026-01-01', title: 'First entry', preview: 'The beginning' },
];

describe('Timeline', () => {
  beforeEach(() => {
    mocks.getTimelineEntries.mockReset();
    setEntryDates(['2026-01-01', '2026-02-01']);
    resetUiState();
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
    expect(selectedDate()).toBe('2026-03-15');
    expect(mainView()).toBe('editor');
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
});
