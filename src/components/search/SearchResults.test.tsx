import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@solidjs/testing-library';
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
