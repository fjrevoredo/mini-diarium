import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import type { SearchResult } from '../../lib/tauri';

/**
 * SearchOverlay mounts the existing SearchBar + SearchResults inside a Kobalte Dialog.
 * These tests cover the overlay open/close visibility and the result-click flow that
 * TODO-0053 added: a click must deep-link the entry, switch to the editor view, and
 * close the overlay.
 */

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockResult: SearchResult = {
  id: 42,
  date: '2026-06-26',
  title: 'Picnic plans',
  snippet: '<mark>Picnic</mark> plans',
};

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return { ...actual, searchEntries: vi.fn(async () => [mockResult]) };
});

// Pass-through debounce so performSearch fires synchronously (debounce itself is not
// under test here).
vi.mock('../../lib/debounce', () => ({
  debounce: (fn: (...args: unknown[]) => unknown) =>
    Object.assign((...args: unknown[]) => fn(...args), { cancel: () => {} }),
}));

// ── Import-after-mock ─────────────────────────────────────────────────────────

import SearchOverlay from './SearchOverlay';
import {
  setIsSearchOpen,
  isSearchOpen,
  selectedEntryId,
  selectedDate,
  mainView,
  resetUiState,
} from '../../state/ui';
import { setSearchQuery, resetSearchState } from '../../state/search';

/** Flush pending microtasks so effects and the mocked async search settle. */
async function flush() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('SearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSearchState();
    resetUiState();
  });

  afterEach(() => {
    resetSearchState();
    resetUiState();
  });

  it('renders no input when closed and shows the input when open', async () => {
    renderWithI18n(() => <SearchOverlay />);
    expect(screen.queryByPlaceholderText('Search entries...')).toBeNull();

    setIsSearchOpen(true);
    await flush();

    expect(screen.getByPlaceholderText('Search entries...')).toBeInTheDocument();
    expect(isSearchOpen()).toBe(true);
  });

  it('clears search state when the dialog is closed', async () => {
    renderWithI18n(() => <SearchOverlay />);
    setIsSearchOpen(true);
    setSearchQuery('picnic');
    await flush();

    // Close via the controlled open signal (mimics onOpenChange → resetSearchState).
    setIsSearchOpen(false);
    await flush();

    expect(isSearchOpen()).toBe(false);
    // resetSearchState is wired into the overlay's onOpenChange(false).
    const { searchQuery, searchResults } = await import('../../state/search');
    expect(searchQuery()).toBe('');
    expect(searchResults()).toEqual([]);
  });

  it('clicking a result deep-links the entry, switches to the editor, and closes the overlay', async () => {
    renderWithI18n(() => <SearchOverlay />);
    setIsSearchOpen(true);
    setSearchQuery('picnic');
    await flush();
    await flush();

    const resultButton = await screen.findByText('Picnic plans');
    fireEvent.click(resultButton);

    expect(selectedEntryId()).toBe(42);
    expect(selectedDate()).toBe('2026-06-26');
    expect(mainView()).toBe('editor');
    expect(isSearchOpen()).toBe(false);
  });
});
