import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import type { SearchResult } from '../../lib/tauri';
import SearchResults from './SearchResults';
import {
  setSearchResults,
  setTotalMatches,
  focusedResultIndex,
  setFocusedResultIndex,
  resetSearchState,
} from '../../state/search';
import { registerNavigationGuard } from '../../state/entries';
import {
  selectedDate,
  selectedEntryId,
  mainView,
  isSearchOpen,
  setIsSearchOpen,
} from '../../state/ui';

function makeResult(id: number, title: string): SearchResult {
  return { id, date: '2026-01-01', title, snippet: '' };
}

describe('SearchResults keyboard navigation', () => {
  beforeEach(() => {
    resetSearchState();
  });

  afterEach(() => {
    resetSearchState();
  });

  it('ArrowDown on a result moves focus to the next result', () => {
    setSearchResults([makeResult(1, 'A'), makeResult(2, 'B'), makeResult(3, 'C')]);
    setTotalMatches(3);
    const { getAllByRole } = renderWithI18n(() => <SearchResults />);
    const buttons = getAllByRole('button');
    setFocusedResultIndex(0);
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' });
    expect(focusedResultIndex()).toBe(1);
  });

  it('ArrowDown on the last result stays on the last result', () => {
    setSearchResults([makeResult(1, 'A'), makeResult(2, 'B')]);
    setTotalMatches(2);
    const { getAllByRole } = renderWithI18n(() => <SearchResults />);
    const buttons = getAllByRole('button');
    setFocusedResultIndex(1);
    fireEvent.keyDown(buttons[1], { key: 'ArrowDown' });
    expect(focusedResultIndex()).toBe(1);
  });

  it('ArrowUp on the first result resets focusedResultIndex to -1', () => {
    setSearchResults([makeResult(1, 'A'), makeResult(2, 'B')]);
    setTotalMatches(2);
    const { getAllByRole } = renderWithI18n(() => <SearchResults />);
    const buttons = getAllByRole('button');
    setFocusedResultIndex(0);
    fireEvent.keyDown(buttons[0], { key: 'ArrowUp' });
    expect(focusedResultIndex()).toBe(-1);
  });

  it('ArrowUp on a non-first result moves focus up one', () => {
    setSearchResults([makeResult(1, 'A'), makeResult(2, 'B'), makeResult(3, 'C')]);
    setTotalMatches(3);
    const { getAllByRole } = renderWithI18n(() => <SearchResults />);
    const buttons = getAllByRole('button');
    setFocusedResultIndex(2);
    fireEvent.keyDown(buttons[2], { key: 'ArrowUp' });
    expect(focusedResultIndex()).toBe(1);
  });
});

describe('SearchResults — result click (TODO-0104: guarded navigation)', () => {
  beforeEach(() => {
    resetSearchState();
    setIsSearchOpen(true);
  });

  afterEach(() => {
    resetSearchState();
    setIsSearchOpen(false);
  });

  it('clicking a result calls requestNavigationConsent exactly once for the combined change, then closes the overlay', async () => {
    const guard = vi.fn(async () => true);
    const unregister = registerNavigationGuard(guard);
    try {
      setSearchResults([makeResult(1, 'A')]);
      setTotalMatches(1);
      const { getAllByRole } = renderWithI18n(() => <SearchResults />);

      fireEvent.click(getAllByRole('button')[0]);

      await waitFor(() => expect(selectedDate()).toBe('2026-01-01'));
      expect(guard).toHaveBeenCalledTimes(1);
      expect(mainView()).toBe('editor');
      expect(isSearchOpen()).toBe(false);
      expect(selectedEntryId()).toBe(1);
    } finally {
      unregister();
    }
  });

  it('a denying guard leaves the overlay open and clears the deep-link id rather than leaving it stale', async () => {
    const unregister = registerNavigationGuard(async () => false);
    try {
      setSearchResults([makeResult(2, 'B')]);
      setTotalMatches(1);
      const { getAllByRole } = renderWithI18n(() => <SearchResults />);

      fireEvent.click(getAllByRole('button')[0]);

      // Regression: a denied click must not leave selectedEntryId dangling at the
      // cancelled target's id — loadEntriesForDate consumes it unconditionally on the
      // very next date load anywhere in the app (any date, any trigger), so a stale id
      // here would silently deep-link into this entry on some later, unrelated navigation
      // instead of that day's default entry.
      await waitFor(() => expect(selectedEntryId()).toBe(null));
      expect(isSearchOpen()).toBe(true);
    } finally {
      unregister();
    }
  });
});
