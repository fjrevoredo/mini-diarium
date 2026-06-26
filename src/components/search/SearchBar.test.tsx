import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../test/i18n-test-utils';
import type { SearchResult } from '../../lib/tauri';

/**
 * Tests for the monotonic latest-wins guard in SearchBar's performSearch
 * (SearchBar.tsx:17-41). The guard is reachable only via the query-change
 * createEffect → debouncedSearch, so we drive it through setSearchQuery and
 * resolve backend promises out of order.
 */

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const harness = vi.hoisted(() => {
  type Deferred = {
    resolve: (value: SearchResult[]) => void;
    reject: (reason?: unknown) => void;
  };
  const deferreds: Deferred[] = [];
  // Each searchEntries() call returns a fresh deferred promise so the test can
  // resolve/reject them in any order.
  const searchEntries = vi.fn(() => {
    let resolve!: (value: SearchResult[]) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<SearchResult[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    deferreds.push({ resolve, reject });
    return promise;
  });
  return { deferreds, searchEntries };
});

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return { ...actual, searchEntries: harness.searchEntries };
});

// Pass-through debounce so performSearch fires synchronously — isolates the seq
// guard from timer/flush fragility (debounce itself is not under test here).
vi.mock('../../lib/debounce', () => ({
  debounce: (fn: (...args: unknown[]) => unknown) =>
    Object.assign((...args: unknown[]) => fn(...args), { cancel: () => {} }),
}));

// ── Import-after-mock ─────────────────────────────────────────────────────────

import SearchBar from './SearchBar';
import { setSearchQuery, searchResults, isSearching, resetSearchState } from '../../state/search';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(id: number, title: string): SearchResult {
  return { id, date: '2026-04-23', title, snippet: `<mark>${title}</mark>` };
}

/** Flush pending microtasks so the query effect runs and awaits settle. */
async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SearchBar stale-response guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.deferreds.length = 0;
    resetSearchState();
  });

  afterEach(() => {
    resetSearchState();
  });

  it('ignores a stale resolve so the newer query wins', async () => {
    renderWithI18n(() => <SearchBar />);
    await flushMicrotasks();

    // Start query A (seq 1, pending).
    setSearchQuery('alpha');
    await flushMicrotasks();
    // Start query B (seq 2, pending).
    setSearchQuery('beta');
    await flushMicrotasks();

    expect(harness.deferreds).toHaveLength(2);
    const [deferredA, deferredB] = harness.deferreds;
    const resultsB = [makeResult(2, 'beta')];
    const resultsA = [makeResult(1, 'alpha')];

    // Resolve B (newest) first — it commits.
    deferredB.resolve(resultsB);
    await flushMicrotasks();
    // Then resolve A (stale) — must be ignored.
    deferredA.resolve(resultsA);
    await flushMicrotasks();

    expect(searchResults()).toEqual(resultsB);
    // The stale resolve's finally guard must not leave isSearching stuck on.
    expect(isSearching()).toBe(false);
  });

  it('ignores a stale rejection so it cannot clobber the newer success', async () => {
    renderWithI18n(() => <SearchBar />);
    await flushMicrotasks();

    setSearchQuery('alpha');
    await flushMicrotasks();
    setSearchQuery('beta');
    await flushMicrotasks();

    expect(harness.deferreds).toHaveLength(2);
    const [deferredA, deferredB] = harness.deferreds;
    const resultsB = [makeResult(2, 'beta')];

    // Newer query B succeeds and commits.
    deferredB.resolve(resultsB);
    await flushMicrotasks();
    // Older query A rejects afterwards — its catch must bail before setSearchResults([]).
    deferredA.reject(new Error('stale failure'));
    await flushMicrotasks();

    expect(searchResults()).toEqual(resultsB);
    expect(isSearching()).toBe(false);
  });
});
