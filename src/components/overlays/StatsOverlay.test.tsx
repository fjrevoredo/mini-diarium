import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderWithI18n } from '../../test/i18n-test-utils';
import * as tauri from '../../lib/tauri';
import StatsOverlay from './StatsOverlay';

const mockStats: tauri.Statistics = {
  total_entries: 42,
  entries_per_week: 3.5,
  best_streak: 7,
  current_streak: 2,
  total_words: 5000,
  avg_words_per_entry: 119,
};

describe('StatsOverlay', () => {
  beforeEach(() => {
    vi.spyOn(tauri, 'getStatistics').mockResolvedValue(mockStats);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading spinner while getStatistics is pending', () => {
    vi.spyOn(tauri, 'getStatistics').mockReturnValue(new Promise(() => {}));
    renderWithI18n(() => <StatsOverlay isOpen={true} onClose={vi.fn()} />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText('Total Entries')).not.toBeInTheDocument();
  });

  it('displays all six stat rows once getStatistics resolves', async () => {
    renderWithI18n(() => <StatsOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Total Entries')).toBeInTheDocument());
    expect(screen.getByText('Entries per Week')).toBeInTheDocument();
    expect(screen.getByText('Best Streak')).toBeInTheDocument();
    expect(screen.getByText('Current Streak')).toBeInTheDocument();
    expect(screen.getByText('Total Words')).toBeInTheDocument();
    expect(screen.getByText('Avg. Words per Entry')).toBeInTheDocument();
  });

  it('shows error alert when getStatistics rejects', async () => {
    vi.spyOn(tauri, 'getStatistics').mockRejectedValue(new Error('Network error'));
    renderWithI18n(() => <StatsOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn();
    renderWithI18n(() => <StatsOverlay isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls getStatistics again when isOpen transitions from false to true', async () => {
    vi.spyOn(tauri, 'getStatistics').mockResolvedValue(mockStats);
    const [isOpen, setIsOpen] = createSignal(false);
    renderWithI18n(() => <StatsOverlay isOpen={isOpen()} onClose={vi.fn()} />);
    expect(tauri.getStatistics).not.toHaveBeenCalled();
    setIsOpen(true);
    await waitFor(() => expect(tauri.getStatistics).toHaveBeenCalledTimes(1));
  });

  it('renders singular form "1 day" when best_streak is 1', async () => {
    vi.spyOn(tauri, 'getStatistics').mockResolvedValue({ ...mockStats, best_streak: 1 });
    renderWithI18n(() => <StatsOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('1 day')).toBeInTheDocument());
  });

  it('renders plural form "N days" when best_streak is greater than 1', async () => {
    vi.spyOn(tauri, 'getStatistics').mockResolvedValue({ ...mockStats, best_streak: 5 });
    renderWithI18n(() => <StatsOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('5 days')).toBeInTheDocument());
  });
});
