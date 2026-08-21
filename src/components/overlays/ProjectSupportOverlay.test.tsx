import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';

const { mockGetStatistics } = vi.hoisted(() => ({
  mockGetStatistics: vi.fn(),
}));
vi.mock('../../lib/tauri/statistics', () => ({
  getStatistics: mockGetStatistics,
}));

const { mockOpenUrlSuppressingFocusLoss } = vi.hoisted(() => ({
  mockOpenUrlSuppressingFocusLoss: vi.fn(),
}));
vi.mock('../../lib/dialog', () => ({
  openUrlSuppressingFocusLoss: mockOpenUrlSuppressingFocusLoss,
}));

const { mockDismissSupportMilestone } = vi.hoisted(() => ({
  mockDismissSupportMilestone: vi.fn(),
}));
vi.mock('../../state/support-milestone', () => ({
  dismissSupportMilestone: mockDismissSupportMilestone,
}));

// Isolate the overlay from project-support.ts's module-level signal, which
// otherwise leaks checklist state across tests in this file (real localStorage
// persistence is covered by project-support.test.ts). Built with a real Solid
// signal (not a plain Set) so the mocked reads stay reactive inside JSX.
vi.mock('../../state/project-support', async () => {
  const { createSignal } = await import('solid-js');
  const [done, setDone] = createSignal<Set<string>>(new Set());
  return {
    __resetChecklist: () => setDone(new Set<string>()),
    isChecklistItemDone: (item: string) => done().has(item),
    toggleChecklistItem: (item: string) => {
      const next = new Set(done());
      if (next.has(item)) next.delete(item);
      else next.add(item);
      setDone(next);
    },
    checklistDoneCount: () => done().size,
  };
});

import * as uiState from '../../state/ui';
import * as projectSupportState from '../../state/project-support';
import ProjectSupportOverlay from './ProjectSupportOverlay';

const resetChecklist = () =>
  (projectSupportState as unknown as { __resetChecklist: () => void }).__resetChecklist();

function openOverlay(entry: 'milestone' | 'about') {
  uiState.setProjectSupportEntry(entry);
  uiState.setIsProjectSupportOpen(true);
}

describe('ProjectSupportOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
    uiState.setIsProjectSupportOpen(false);
    uiState.setProjectSupportEntry('about');
    mockGetStatistics.mockReset();
    mockGetStatistics.mockResolvedValue({
      total_entries: 0,
      entries_per_week: 0,
      best_streak: 0,
      current_streak: 0,
      total_words: 0,
      avg_words_per_entry: 0,
    });
    mockOpenUrlSuppressingFocusLoss.mockReset();
    mockDismissSupportMilestone.mockReset();
    resetChecklist();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the About opening line for the about entry point', () => {
    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);
    expect(
      screen.getByText(/Mini Diarium is free, encrypted, and has no ads or tracking/),
    ).toBeInTheDocument();
  });

  it('renders the milestone opening line, interpolated with real stats', async () => {
    mockGetStatistics.mockResolvedValue({
      total_entries: 10,
      entries_per_week: 7,
      best_streak: 7,
      current_streak: 7,
      total_words: 1234,
      avg_words_per_entry: 100,
    });
    openOverlay('milestone');
    renderWithI18n(() => <ProjectSupportOverlay />);

    await waitFor(() => {
      expect(screen.getByText(/7-day streak/)).toBeInTheDocument();
      expect(screen.getByText(/1234 words/)).toBeInTheDocument();
    });
  });

  it.each([
    ['support-item-star', 'https://github.com/fjrevoredo/mini-diarium'],
    ['support-item-review', 'https://apps.microsoft.com/detail/9PJFTX44ZS43'],
    ['support-item-newsletter', 'https://mini-diarium.com/newsletter/'],
    ['support-item-contribute', 'https://github.com/fjrevoredo/mini-diarium'],
    ['support-item-donate', 'https://mini-diarium.com/donate/'],
  ] as const)('clicking %s opens %s via openUrlSuppressingFocusLoss', (testId, url) => {
    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);

    fireEvent.click(screen.getByTestId(testId));

    expect(mockOpenUrlSuppressingFocusLoss).toHaveBeenCalledWith(url);
  });

  it('clicking Share with a resolving clipboard write checks the item and does not open a URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);

    fireEvent.click(screen.getByTestId('support-item-share'));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(mockOpenUrlSuppressingFocusLoss).not.toHaveBeenCalled();
  });

  it('clicking Share with a rejecting clipboard write leaves the item unchecked and shows the fallback text', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);

    fireEvent.click(screen.getByTestId('support-item-share'));

    await waitFor(() => {
      expect(screen.getByText(/Couldn't copy/)).toBeInTheDocument();
    });
  });

  it('clears the clipboard-failure fallback text on close, so it does not leak into the next open (component stays mounted in MainLayout — only the Dialog portal unmounts)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);

    fireEvent.click(screen.getByTestId('support-item-share'));
    await waitFor(() => {
      expect(screen.getByText(/Couldn't copy/)).toBeInTheDocument();
    });

    // Close via the bottom Close button (handleClose), then reopen the same instance.
    fireEvent.click(screen.getByText('Close'));
    openOverlay('about');

    expect(screen.queryByText(/Couldn't copy/)).not.toBeInTheDocument();
  });

  it('checking an item flips its checkmark and updates the footer text', () => {
    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);

    expect(
      screen.getByText('Any one of these helps more than you might think.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('support-item-star'));

    expect(screen.getByText('Thank you for supporting Mini Diarium!')).toBeInTheDocument();
  });

  it('closing from the milestone entry point calls dismissSupportMilestone', () => {
    openOverlay('milestone');
    renderWithI18n(() => <ProjectSupportOverlay />);

    fireEvent.click(screen.getByText('Close'));

    expect(mockDismissSupportMilestone).toHaveBeenCalled();
  });

  it('closing from the about entry point does not call dismissSupportMilestone', () => {
    openOverlay('about');
    renderWithI18n(() => <ProjectSupportOverlay />);

    fireEvent.click(screen.getByText('Close'));

    expect(mockDismissSupportMilestone).not.toHaveBeenCalled();
  });
});
