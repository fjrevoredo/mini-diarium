/* eslint-disable solid/reactivity -- intentional test shim, not a reactive component */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEffect, onCleanup } from 'solid-js';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import type { DiaryEntry } from '../../lib/tauri';

/**
 * Integration tests for EditorPanel covering the four flows called out in the
 * M6 review: load-then-type, switch-day-while-unsaved, delete-empty-on-nav,
 * create-on-first-keystroke — plus the TODO-0089 body-wipe races.
 *
 * TipTap refuses to mount in jsdom, so `DiaryEditor` is replaced with a fake that
 * models the parts of the real lifecycle these tests depend on: `getHTML()` tracks
 * the document, `isEmpty` follows it, the `props.content` sync effect mirrors
 * DiaryEditor's own (setContent + onSetContent, never onUpdate), image nodes are
 * visible to `state.doc.descendants`, and `isDestroyed` flips in `onCleanup` — which
 * in dev builds runs BEFORE the parent's `lifecycle.dispose()`, so teardown tests
 * exercise the destroyed-editor fallback rather than a conveniently alive mock.
 * A shared `editorBus` lets tests synchronously drive callbacks the way TipTap would.
 */

// ── Shared editor bus + tauri mocks (hoisted so vi.mock sees them) ────────────

const bus = vi.hoisted(() => {
  const state = {
    onUpdate: null as ((html: string) => void) | null,
    onSetContent: null as ((isEmpty: boolean) => void) | null,
    onImportMarkdown: null as (() => void) | null,
    lastContent: '' as string,
    mockEditor: null as unknown as {
      isEmpty: boolean;
      isDestroyed: boolean;
      getHTML: () => string;
      getText: () => string;
      commands: { setContent: (html: string) => void; focus: () => void };
      chain: () => {
        focus: () => { setHorizontalRule: () => { insertContent: () => { run: () => void } } };
      };
      state: { doc: { descendants: (fn: (node: { type: { name: string } }) => void) => void } };
    },
  };
  return state;
});

/** Mirrors TipTap's notion of an empty document for the HTML shells the editor emits. */
const isBlankHtml = vi.hoisted(
  () => (html: string) => !html || html === '<p></p>' || html === '<p><br></p>',
);

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  saveEntry: vi.fn(),
  deleteEntry: vi.fn(),
  deleteEntryIfEmpty: vi.fn(),
  entryHasContent: vi.fn(),
  getEntriesForDate: vi.fn(),
  getAllEntryDates: vi.fn(),
  getEntryImages: vi.fn(),
  setEntryLocked: vi.fn(),
  getLockedEntryDates: vi.fn(),
  readTextFile: vi.fn(),
  confirm: vi.fn(),
  open: vi.fn(() => Promise.resolve(null as string | null)),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    createEntry: mocks.createEntry,
    saveEntry: mocks.saveEntry,
    deleteEntry: mocks.deleteEntry,
    deleteEntryIfEmpty: mocks.deleteEntryIfEmpty,
    entryHasContent: mocks.entryHasContent,
    getEntriesForDate: mocks.getEntriesForDate,
    getAllEntryDates: mocks.getAllEntryDates,
    getEntryImages: mocks.getEntryImages,
    setEntryLocked: mocks.setEntryLocked,
    getLockedEntryDates: mocks.getLockedEntryDates,
    readTextFile: mocks.readTextFile,
  };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mocks.open,
}));

// handleDeleteEntry's confirm was migrated from the native confirm() to the in-app
// confirmInApp() (Task 2.3) — mock only that export; isConfirmDialogOpen() etc. stay
// real so state/ui.ts's isAnyOverlayOpen() (imported by this suite) keeps working.
vi.mock('../../state/confirm-dialog', async () => {
  const actual = await vi.importActual<typeof import('../../state/confirm-dialog')>(
    '../../state/confirm-dialog',
  );
  return {
    ...actual,
    confirmInApp: mocks.confirm,
  };
});

vi.mock('../editor/DiaryEditor', () => {
  return {
    default: (props: {
      content: string;
      onUpdate?: (html: string) => void;
      onSetContent?: (isEmpty: boolean) => void;
      onEditorReady?: (editor: unknown) => void;
      onImportMarkdown?: () => void;
      entryMetadata?: import('../../lib/tauri').EntryMetadata | null;
      onEntryMetadataChange?: (meta: import('../../lib/tauri').EntryMetadata | null) => void;
    }) => {
      bus.onUpdate = props.onUpdate ?? null;
      bus.onSetContent = props.onSetContent ?? null;
      bus.onImportMarkdown = props.onImportMarkdown ?? null;

      // Wire a mock editor that mirrors the surface EditorPanel reads.
      const editor = {
        isEmpty: isBlankHtml(props.content),
        isDestroyed: false,
        getHTML: () => bus.lastContent,
        getText: () => bus.lastContent.replace(/<[^>]*>/g, ''),
        commands: {
          setContent: (html: string) => {
            bus.lastContent = html;
            editor.isEmpty = isBlankHtml(html);
            bus.onSetContent?.(editor.isEmpty);
          },
          focus: () => {},
        },
        chain: () => ({
          focus: () => ({
            setHorizontalRule: () => ({
              insertContent: () => ({ run: () => {} }),
            }),
          }),
        }),
        state: {
          doc: {
            // An image-only document has no text but is NOT empty — computeIsEmpty
            // relies on this to keep editorHasImages() honest.
            descendants: (fn: (node: { type: { name: string } }) => void) => {
              if (/<img\b/i.test(bus.lastContent)) fn({ type: { name: 'image' } });
            },
          },
        },
      };
      bus.mockEditor = editor;
      bus.lastContent = props.content;
      props.onEditorReady?.(editor);

      // Mirror DiaryEditor's own content-sync effect: a programmatic content change is
      // applied to the document and reported via onSetContent (never via onUpdate).
      createEffect(() => {
        const next = props.content;
        if (editor.isDestroyed || next === bus.lastContent) return;
        bus.lastContent = next;
        editor.isEmpty = isBlankHtml(next);
        props.onSetContent?.(editor.isEmpty);
      });

      onCleanup(() => {
        editor.isDestroyed = true;
      });

      return <div data-testid="diary-editor-shim">{props.content}</div>;
    },
  };
});

// ── Import-after-mock ─────────────────────────────────────────────────────────

import EditorPanel from './EditorPanel';
import { setSelectedDate, selectedEntryId, setSelectedEntryId } from '../../state/ui';
import { setIsSaving, requestNavigationConsent } from '../../state/entries';
import { setHasFocusedEditorOnUnlock } from '../../state/session';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<DiaryEntry>): DiaryEntry {
  return {
    id: overrides.id ?? 1,
    date: overrides.date ?? '2026-04-23',
    title: overrides.title ?? '',
    text: overrides.text ?? '',
    word_count: overrides.word_count ?? 0,
    date_created: overrides.date_created ?? '2026-04-23T10:00:00Z',
    date_updated: overrides.date_updated ?? '2026-04-23T10:00:00Z',
    metadata: overrides.metadata,
    locked: overrides.locked ?? false,
  };
}

/** Drive the shim's onUpdate as TipTap would after a keystroke. */
function typeIntoEditor(html: string) {
  bus.lastContent = html;
  if (bus.mockEditor) {
    bus.mockEditor.isEmpty = !html || html === '<p></p>';
  }
  bus.onUpdate?.(html);
}

/** Flush all pending microtasks — awaits Tauri invoke + state settlement. */
async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EditorPanel integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bus.onUpdate = null;
    bus.onSetContent = null;
    bus.lastContent = '';
    mocks.getEntriesForDate.mockResolvedValue([]);
    mocks.getAllEntryDates.mockResolvedValue([]);
    mocks.getEntryImages.mockResolvedValue([]);
    mocks.saveEntry.mockResolvedValue(undefined);
    mocks.deleteEntryIfEmpty.mockResolvedValue(true);
    mocks.deleteEntry.mockResolvedValue(undefined);
    mocks.entryHasContent.mockResolvedValue(false);
    mocks.setEntryLocked.mockResolvedValue(undefined);
    mocks.getLockedEntryDates.mockResolvedValue([]);
    mocks.confirm.mockResolvedValue(true);
    setSelectedDate('2026-04-23');
    // Session flag is module-global; reset so each test starts pre-focus.
    setHasFocusedEditorOnUnlock(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    setIsSaving(false);
    // Deep-link target is a module-global signal; clear it between tests.
    setSelectedEntryId(null);
  });

  it('load-then-type: loads existing entry and debounced-saves a keystroke edit', async () => {
    const existing = makeEntry({ id: 42, title: 'Morning', text: '<p>Hello</p>' });
    mocks.getEntriesForDate.mockResolvedValue([existing]);

    renderWithI18n(() => <EditorPanel />);

    // Wait for the initial load effect to resolve the getEntriesForDate Promise.
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // Simulate the user typing additional content.
    typeIntoEditor('<p>Hello world</p>');
    // Debounce is 500 ms; advance past it.
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    expect(mocks.saveEntry).toHaveBeenCalledWith(42, 'Morning', '<p>Hello world</p>', null);
    // Must not have treated the typed content as empty (no delete).
    expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
  });

  it('lock-toggle: locking flushes content, calls setEntryLocked, and makes the entry read-only', async () => {
    const existing = makeEntry({ id: 55, title: 'Keep me', text: '<p>Body</p>' });
    mocks.getEntriesForDate.mockResolvedValue([existing]);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    const lockBtn = screen.getByTestId('entry-lock-button') as HTMLButtonElement;
    // Enabled because the loaded entry has a persisted id.
    expect(lockBtn.disabled).toBe(false);

    fireEvent.click(lockBtn);

    await waitFor(() => {
      expect(mocks.setEntryLocked).toHaveBeenCalledWith(55, true);
    });
    await flushMicrotasks();

    // Locking first flushes the current content (by id + title) so nothing in-flight is lost.
    expect(mocks.saveEntry).toHaveBeenCalledWith(55, 'Keep me', expect.any(String), null);
    // Indicators refresh after the toggle.
    expect(mocks.getLockedEntryDates).toHaveBeenCalled();

    // Title input becomes read-only, reflecting the now-locked entry.
    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toHaveAttribute('readonly');
    });
    // The delete button (visible only for multi-entry days) is gone here, but the lock
    // button now advertises the "unlock" affordance.
    expect(screen.getByTestId('entry-lock-button').getAttribute('aria-label')).toBe('Unlock entry');
  });

  it('lock-toggle: aborts without locking when the guard denies navigation (TODO-0104)', async () => {
    const existing = makeEntry({ id: 56, title: 'Keep me', text: '<p>Body</p>' });
    mocks.getEntriesForDate.mockResolvedValue([existing]);
    mocks.entryHasContent.mockResolvedValue(true); // on-disk row still has the old content
    mocks.confirm.mockResolvedValue(false); // user cancels the confirm dialog

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // Erase title and body — the debounce is not awaited, so no save/delete fires here.
    const titleInput = screen.getByTestId('title-input') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: '' } });
    typeIntoEditor('<p></p>');
    await flushMicrotasks();

    const lockBtn = screen.getByTestId('entry-lock-button') as HTMLButtonElement;
    fireEvent.click(lockBtn);

    await waitFor(() => expect(mocks.entryHasContent).toHaveBeenCalledWith(56));
    await flushMicrotasks();

    expect(mocks.confirm).toHaveBeenCalled();
    expect(mocks.setEntryLocked).not.toHaveBeenCalled();
    // Lock button still advertises "lock" (not "unlock") — nothing was locked.
    expect(screen.getByTestId('entry-lock-button').getAttribute('aria-label')).toBe('Lock entry');
  });

  it('switch-day-while-unsaved: flushes pending save before loading the new day', async () => {
    const day1Entry = makeEntry({
      id: 7,
      date: '2026-04-23',
      title: 'Day 1',
      text: '<p>Day 1</p>',
    });
    const day2Entry = makeEntry({
      id: 8,
      date: '2026-04-24',
      title: 'Day 2',
      text: '<p>Day 2</p>',
    });
    mocks.getEntriesForDate.mockImplementation(async (date: string) => {
      if (date === '2026-04-23') return [day1Entry];
      if (date === '2026-04-24') return [day2Entry];
      return [];
    });

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // Type an unsaved edit (queues the 500 ms debounce).
    typeIntoEditor('<p>Day 1 edited</p>');
    // Switch dates BEFORE the debounce fires.
    setSelectedDate('2026-04-24');

    // The synchronous pre-load flush path should call saveEntry(7, …) with the latest content.
    await waitFor(() => {
      expect(mocks.saveEntry).toHaveBeenCalledWith(7, 'Day 1', '<p>Day 1 edited</p>', null);
    });
    await flushMicrotasks();
    expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-24');

    // Advance timers — the cancelled debounce must NOT fire an extra save against the old id.
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    const saveCalls = mocks.saveEntry.mock.calls.filter((c) => c[0] === 7);
    expect(saveCalls).toHaveLength(1);
  });

  it('delete-empty-on-nav: clears a blank entry when the user navigates to a new date', async () => {
    const blank = makeEntry({ id: 11, date: '2026-04-23', title: '', text: '<p></p>' });
    const other = makeEntry({ id: 12, date: '2026-04-24', title: 'Real', text: '<p>Real</p>' });
    mocks.getEntriesForDate.mockImplementation(async (date: string) => {
      if (date === '2026-04-23') return [blank];
      if (date === '2026-04-24') return [other];
      return [];
    });

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // Simulate TipTap reporting empty after the programmatic load.
    bus.onSetContent?.(true);
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    // Now switch days — the pre-load save path treats the blank current entry as delete-worthy.
    setSelectedDate('2026-04-24');
    // The real body travels to the backend now (TODO-0089) — the empty HTML shell is
    // what makes it delete-worthy, and the backend re-checks it.
    await waitFor(() => {
      expect(mocks.deleteEntryIfEmpty).toHaveBeenCalledWith(11, '', '<p></p>');
    });
    await flushMicrotasks();
    expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-24');
  });

  it('create-on-first-keystroke: creates a new entry and debounces the save', async () => {
    // Start with an empty day.
    mocks.getEntriesForDate.mockResolvedValue([]);
    mocks.createEntry.mockImplementation(async (date: string) =>
      makeEntry({ id: 99, date, title: '', text: '' }),
    );

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // Simulate the first real keystroke.
    typeIntoEditor('<p>H</p>');
    // createEntry fires immediately (synchronous call, awaited inside async IIFE).
    await waitFor(() => {
      expect(mocks.createEntry).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // After createEntry resolves, the hook queues a debounced save against id=99.
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    expect(mocks.saveEntry).toHaveBeenCalledWith(99, '', '<p>H</p>', null);
    // Interface sanity: the shim rendered.
    expect(screen.getByTestId('diary-editor-shim')).toBeInTheDocument();
  });

  it('creation-race: unmounting before createEntry resolves still persists the typed content', async () => {
    // Start with an empty day so the first keystroke triggers startEntryCreation.
    mocks.getEntriesForDate.mockResolvedValue([]);
    let resolveCreate!: (entry: DiaryEntry) => void;
    mocks.createEntry.mockImplementation(
      () =>
        new Promise<DiaryEntry>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { unmount } = renderWithI18n(() => <EditorPanel />);
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // First keystroke on a blank day — fires createEntry, but it never resolves yet.
    typeIntoEditor('<p>Unsaved thought</p>');
    await waitFor(() => {
      expect(mocks.createEntry).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // Navigate away by unmounting — exactly what <Show> does when MainLayout swaps to
    // the Timeline branch. This must NOT lose the typed content (TODO-0089).
    unmount();

    // createEntry now resolves, after the component is gone.
    resolveCreate(makeEntry({ id: 101, date: '2026-04-23', title: '', text: '' }));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    expect(mocks.saveEntry).toHaveBeenCalledWith(101, '', '<p>Unsaved thought</p>', null);
    expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
  });

  it('creation-race: switching dates before createEntry resolves still persists the typed content', async () => {
    // Day 1 starts empty; day 2 has its own existing entry.
    const day2Entry = makeEntry({
      id: 8,
      date: '2026-04-24',
      title: 'Day 2',
      text: '<p>Day 2</p>',
    });
    mocks.getEntriesForDate.mockImplementation(async (date: string) => {
      if (date === '2026-04-24') return [day2Entry];
      return [];
    });
    let resolveCreate!: (entry: DiaryEntry) => void;
    mocks.createEntry.mockImplementation(
      () =>
        new Promise<DiaryEntry>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => {
      expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // First keystroke on the blank day 1 — fires createEntry, never resolves yet.
    typeIntoEditor('<p>Day 1 unsaved</p>');
    await waitFor(() => {
      expect(mocks.createEntry).toHaveBeenCalledWith('2026-04-23');
    });
    await flushMicrotasks();

    // Switch dates before the in-flight creation resolves.
    setSelectedDate('2026-04-24');
    await flushMicrotasks();

    // createEntry now resolves — this must save-or-delete by id directly, without
    // clobbering the day-2 UI state that has already loaded.
    resolveCreate(makeEntry({ id: 102, date: '2026-04-23', title: '', text: '' }));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    expect(mocks.saveEntry).toHaveBeenCalledWith(102, '', '<p>Day 1 unsaved</p>', null);
    expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();

    // Day 2's own load proceeded correctly and was not disturbed by the flush.
    expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-24');
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Day 2'),
    );
  });

  // ── TODO-0089: body-wipe races ─────────────────────────────────────────────
  //
  // The shared signature of every case below is `save_entry(id, title, '')` — the entry
  // row survives with its title, and the body is gone. It happens whenever the editor
  // commits WHICH entry it is editing before it knows WHAT that entry contains, because
  // every flush-before-navigating-away path then reads those two from live signals.

  it('superseded load: a load abandoned mid-hydration must not let the next flush write an empty body', async () => {
    const withImage = makeEntry({
      id: 31,
      date: '2026-04-23',
      title: 'Has image',
      text: '<p>Body</p><img src="image-id://5">',
    });
    const day2 = makeEntry({ id: 32, date: '2026-04-24', title: 'Day 2', text: '<p>Day 2</p>' });
    mocks.getEntriesForDate.mockImplementation(async (date: string) =>
      date === '2026-04-23' ? [withImage] : [day2],
    );
    // Hang the image lookup so the day-1 load can never reach its commit.
    mocks.getEntryImages.mockImplementation(() => new Promise(() => {}));

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // Nothing was committed: no id, no title, no body — the editor is coherently blank.
    expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('');

    // Navigate away while that load is still stuck. The pre-load flush must find nothing
    // to write rather than pairing entry 31's id+title with the empty document.
    mocks.getEntryImages.mockResolvedValue([]);
    setSelectedDate('2026-04-24');
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Day 2'),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();

    expect(mocks.saveEntry).not.toHaveBeenCalledWith(31, expect.anything(), '', expect.anything());
    expect(mocks.saveEntry.mock.calls.filter((c) => c[0] === 31)).toHaveLength(0);
    expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
  });

  it('image lookup failure: falls back to the raw body instead of hydrating an empty one', async () => {
    const withImage = makeEntry({
      id: 41,
      date: '2026-04-23',
      title: 'Has image',
      text: '<p>Body</p><img src="image-id://5">',
    });
    mocks.getEntriesForDate.mockResolvedValue([withImage]);
    mocks.getEntryImages.mockRejectedValue(new Error('image store unavailable'));

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // The entry still hydrated — with unresolved refs, which is a display-only degradation.
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Has image'),
    );

    // A flush after that failure must carry the real body, never an empty one.
    setSelectedDate('2026-04-24');
    await waitFor(() => expect(mocks.saveEntry).toHaveBeenCalled());
    await flushMicrotasks();

    const call = mocks.saveEntry.mock.calls.find((c) => c[0] === 41);
    expect(call).toBeDefined();
    expect(call![2]).toContain('image-id://5');
    expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
  });

  it('unmount with a pending debounce: the queued content is flushed, not dropped', async () => {
    const existing = makeEntry({ id: 61, title: 'Journal', text: '<p>Original</p>' });
    mocks.getEntriesForDate.mockResolvedValue([existing]);

    const { unmount } = renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // Type, then unmount inside the 500 ms debounce window — this is the Timeline toggle
    // (<Show> swap in MainLayout), which used to cancel the save and write nothing.
    typeIntoEditor('<p>Original plus more</p>');
    unmount();
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();

    expect(mocks.saveEntry).toHaveBeenCalledWith(61, 'Journal', '<p>Original plus more</p>', null);
    expect(mocks.deleteEntryIfEmpty).not.toHaveBeenCalled();
  });

  it('type-before-load: a keystroke racing the initial load creates no entry and no wrong-id save', async () => {
    const existing = makeEntry({ id: 71, title: 'Loaded', text: '<p>Loaded body</p>' });
    let resolveLoad!: (entries: DiaryEntry[]) => void;
    mocks.getEntriesForDate.mockImplementation(
      () =>
        new Promise<DiaryEntry[]>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // The user types into the still-blank editor before the day's entry arrives.
    typeIntoEditor('<p>Raced keystroke</p>');
    await flushMicrotasks();
    // Creation is deferred, not fired — otherwise the day ends up with a duplicate entry.
    expect(mocks.createEntry).not.toHaveBeenCalled();

    resolveLoad([existing]);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();

    // The load supplied a real entry, so the deferred creation is dropped.
    expect(mocks.createEntry).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Loaded'),
    );
    // No write may name any id other than the one that actually loaded.
    for (const call of mocks.saveEntry.mock.calls) expect(call[0]).toBe(71);
    for (const call of mocks.deleteEntryIfEmpty.mock.calls) expect(call[0]).toBe(71);
    // And nothing wiped entry 71's body.
    expect(mocks.saveEntry).not.toHaveBeenCalledWith(71, expect.anything(), '', expect.anything());
  });

  it('word-count display: updates when content changes', async () => {
    const existing = makeEntry({ id: 42, title: 'Morning', text: '<p>Hello</p>' });
    mocks.getEntriesForDate.mockResolvedValue([existing]);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // After load, countWordsInHtml('<p>Hello</p>') = 1 word.
    await waitFor(() => expect(screen.getByText('1 word')).toBeInTheDocument());

    // Typing plain text keeps the mock getText() clean: no tag fragments.
    typeIntoEditor('hello world');
    await waitFor(() => expect(screen.getByText('2 words')).toBeInTheDocument());
  });

  it('save-status footer: shows "Saving..." while isSaving is true', async () => {
    mocks.getEntriesForDate.mockResolvedValue([]);
    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();

    setIsSaving(true);
    await waitFor(() => expect(screen.getByText('Saving...')).toBeInTheDocument());

    setIsSaving(false);
    await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument());
  });

  it('entry-metadata-preserved: metadata survives a debounced keystroke save', async () => {
    // Entry has a font default already set
    const existing = makeEntry({
      id: 42,
      title: 'Styled',
      text: '<p>Old content</p>',
      metadata: { fontFamily: 'Merriweather', fontSize: 18 },
    });
    mocks.getEntriesForDate.mockResolvedValue([existing]);
    mocks.saveEntry.mockResolvedValue(undefined);
    mocks.getAllEntryDates.mockResolvedValue(['2026-04-23']);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // Simulate a keystroke (no metadata change — just content edit)
    typeIntoEditor('<p>New content</p>');
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    // saveEntry must carry the existing metadata through
    expect(mocks.saveEntry).toHaveBeenCalledWith(42, 'Styled', '<p>New content</p>', {
      fontFamily: 'Merriweather',
      fontSize: 18,
    });
  });

  it("metadata-cleared-on-delete: after deleting entry-with-metadata, the next save uses the remaining entry's own metadata (null)", async () => {
    // entryWithMeta has higher id → newest; entryNoMeta is older.
    // Backend returns newest-first → [entryWithMeta, entryNoMeta].
    const entryWithMeta = makeEntry({
      id: 20,
      title: 'Styled',
      text: '<p>Styled</p>',
      metadata: { fontFamily: 'Merriweather', fontSize: 18 },
    });
    const entryNoMeta = makeEntry({ id: 10, title: 'Plain', text: '<p>Plain</p>' });

    mocks.getEntriesForDate
      .mockResolvedValueOnce([entryWithMeta, entryNoMeta]) // initial load
      .mockResolvedValueOnce([entryNoMeta]); // refresh after delete
    mocks.getAllEntryDates.mockResolvedValue(['2026-04-23']);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    // reversed → [entryNoMeta (idx 0), entryWithMeta (idx 1)]; startIndex = 1 → entryWithMeta active

    // Click delete — EntryNavBar is visible because there are 2 entries.
    const deleteBtn = screen.getByTestId('entry-delete-button');
    fireEvent.click(deleteBtn);

    await waitFor(() => expect(mocks.deleteEntry).toHaveBeenCalledWith(20));
    await flushMicrotasks();
    // entryNoMeta is now active; its metadata is null.

    typeIntoEditor('<p>Plain edited</p>');
    await vi.advanceTimersByTimeAsync(600);
    await flushMicrotasks();

    expect(mocks.saveEntry).toHaveBeenCalledWith(10, 'Plain', '<p>Plain edited</p>', null);
  });

  it('import-markdown: shows error banner when readTextFile fails', async () => {
    const existing = makeEntry({ id: 42, title: '', text: '' });
    mocks.getEntriesForDate.mockResolvedValue([existing]);
    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    mocks.open.mockResolvedValueOnce('/home/user/notes.md');
    mocks.readTextFile.mockRejectedValueOnce(new Error('permission denied'));

    bus.onImportMarkdown?.();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('permission denied')).toBeInTheDocument();
    expect(mocks.saveEntry).not.toHaveBeenCalled();
  });

  it('deep-link-found: opens the requested entry within the day, not the newest, and clears the target', async () => {
    // Backend returns newest-first: [id 20 'Newest', id 10 'Older'].
    // fetchEntriesOrdered reverses → [id 10 (idx 0, button 1), id 20 (idx 1, button 2, newest)].
    const newest = makeEntry({ id: 20, title: 'Newest', text: '<p>Newest</p>' });
    const older = makeEntry({ id: 10, title: 'Older', text: '<p>Older</p>' });
    mocks.getEntriesForDate.mockResolvedValue([newest, older]);

    // Deep-link to the non-newest entry BEFORE mount so loadEntriesForDate consumes it.
    setSelectedEntryId(10);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    // Editor landed on the deep-linked entry (idx 0 / button 1), not the day's newest.
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Older'),
    );
    expect(screen.getByTestId('entry-number-button-1').getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('entry-number-button-2').getAttribute('aria-current')).toBeNull();
    // One-shot: the target was cleared once consumed.
    expect(selectedEntryId()).toBeNull();
  });

  // ── TODO-0104: canLeaveCurrentEntry via navigateToEntry ──────────────────────

  it("navigateToEntry: cancelling the confirm dialog restores the erased entry's real content and leaves dayEntries/currentIndex unchanged", async () => {
    const older = makeEntry({ id: 42, title: 'Keep', text: '<p>Keep</p>' });
    const current = makeEntry({ id: 43, title: 'Erase me', text: '<p>Real content</p>' });
    mocks.getEntriesForDate.mockResolvedValue([current, older]);
    mocks.entryHasContent.mockResolvedValue(true); // on-disk row still has the old content
    mocks.confirm.mockResolvedValue(false); // user cancels

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    // No deep link → lands on the newest (button 2, id 43).
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
    );

    // Erase title and body (debounce not awaited — no save/delete fires here).
    fireEvent.input(screen.getByTestId('title-input'), { target: { value: '' } });
    typeIntoEditor('<p></p>');
    await flushMicrotasks();

    fireEvent.click(screen.getByTestId('entry-number-button-1')); // navigate to `older`
    await waitFor(() => expect(mocks.entryHasContent).toHaveBeenCalledWith(43));
    await flushMicrotasks();

    expect(mocks.confirm).toHaveBeenCalled();
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    // Restored from disk — no longer blank.
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
    );
    expect(bus.mockEditor.getHTML()).toBe('<p>Real content</p>');
    expect(screen.getByTestId('entry-number-button-2').getAttribute('aria-current')).toBe('true');
  });

  it("navigateToEntry: cancelling the confirm dialog restores the correct entry when it is not the day's newest", async () => {
    const newest = makeEntry({ id: 50, title: 'Newest', text: '<p>Newest content</p>' });
    const older = makeEntry({ id: 20, title: 'Erase me', text: '<p>Real older content</p>' });
    // Backend newest-first: [50, 20] -> fetchEntriesOrdered reverses to [older (idx 0), newest (idx 1)].
    mocks.getEntriesForDate.mockResolvedValue([newest, older]);
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirm.mockResolvedValue(false);

    // Deep-link to the older entry so it is the one open, not the day's default newest.
    setSelectedEntryId(20);
    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
    );

    fireEvent.input(screen.getByTestId('title-input'), { target: { value: '' } });
    typeIntoEditor('<p></p>');
    await flushMicrotasks();

    fireEvent.click(screen.getByTestId('entry-number-button-2')); // navigate to the newest
    await waitFor(() => expect(mocks.entryHasContent).toHaveBeenCalledWith(20));
    await flushMicrotasks();

    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    // Restored entry 20's real content on entry-number-button-1 (idx 0) — not entry 50's.
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
    );
    expect(bus.mockEditor.getHTML()).toBe('<p>Real older content</p>');
    expect(screen.getByTestId('entry-number-button-1').getAttribute('aria-current')).toBe('true');
  });

  it('navigateToEntry: confirming the dialog hard-deletes the entry and navigates to the target', async () => {
    const older = makeEntry({ id: 42, title: 'Keep', text: '<p>Keep</p>' });
    const current = makeEntry({ id: 43, title: 'Erase me', text: '<p>Real content</p>' });
    mocks.getEntriesForDate
      .mockResolvedValueOnce([current, older]) // initial load
      .mockResolvedValueOnce([older]); // refresh after the confirmed delete
    mocks.entryHasContent.mockResolvedValue(true);
    mocks.confirm.mockResolvedValue(true); // user confirms

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
    );

    fireEvent.input(screen.getByTestId('title-input'), { target: { value: '' } });
    typeIntoEditor('<p></p>');
    await flushMicrotasks();

    fireEvent.click(screen.getByTestId('entry-number-button-1'));
    await waitFor(() => expect(mocks.deleteEntry).toHaveBeenCalledWith(43));
    await flushMicrotasks();

    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Keep'),
    );
  });

  it('navigateToEntry: a genuinely blank entry (never had content) navigates away silently, no dialog', async () => {
    const blank = makeEntry({ id: 44, title: '', text: '' });
    const other = makeEntry({ id: 45, title: 'Other', text: '<p>Other</p>' });
    mocks.getEntriesForDate.mockResolvedValue([other, blank]);
    // Default beforeEach value (entryHasContent → false) is exactly the case under test —
    // asserted explicitly here rather than relied on implicitly.
    mocks.entryHasContent.mockResolvedValue(false);

    // Deep-link onto the blank entry so it is the one being navigated away FROM.
    setSelectedEntryId(44);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe(''),
    );

    fireEvent.click(screen.getByTestId('entry-number-button-2')); // navigate to `other`
    await waitFor(() => expect(mocks.entryHasContent).toHaveBeenCalledWith(44));
    await flushMicrotasks();

    expect(mocks.confirm).not.toHaveBeenCalled();
    // The soft-delete path (not canLeaveCurrentEntry's own hard delete) removed it.
    expect(mocks.deleteEntryIfEmpty).toHaveBeenCalled();
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Other'),
    );
  });

  it('deep-link-not-found: falls back to the day newest when the target id is absent', async () => {
    const newest = makeEntry({ id: 20, title: 'Newest', text: '<p>Newest</p>' });
    const older = makeEntry({ id: 10, title: 'Older', text: '<p>Older</p>' });
    mocks.getEntriesForDate.mockResolvedValue([newest, older]);

    // Target id not present in this day → fallback to the newest (idx length-1).
    setSelectedEntryId(999);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();

    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Newest'),
    );
    expect(screen.getByTestId('entry-number-button-2').getAttribute('aria-current')).toBe('true');
    // Still cleared even though there was no match.
    expect(selectedEntryId()).toBeNull();
  });

  it('same-day deep-link: navigates within the already-open date and clears the target', async () => {
    // Two entries on the open date; initial load settles on the newest (id 20).
    const newest = makeEntry({ id: 20, title: 'Newest', text: '<p>Newest</p>' });
    const older = makeEntry({ id: 10, title: 'Older', text: '<p>Older</p>' });
    mocks.getEntriesForDate.mockResolvedValue([newest, older]);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    // Settled on the newest (button 2).
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Newest'),
    );

    // Deep-link to another entry on the SAME date — the date effect won't re-fire, so the
    // same-day effect (EditorPanel.tsx:103) drives navigation via nav.navigateToEntry.
    setSelectedEntryId(10);
    await flushMicrotasks();

    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Older'),
    );
    expect(screen.getByTestId('entry-number-button-1').getAttribute('aria-current')).toBe('true');
    expect(selectedEntryId()).toBeNull();
  });

  it('same-day deep-link: a cross-date id no-ops and is left for loadEntriesForDate', async () => {
    const newest = makeEntry({ id: 20, title: 'Newest', text: '<p>Newest</p>' });
    const older = makeEntry({ id: 10, title: 'Older', text: '<p>Older</p>' });
    mocks.getEntriesForDate.mockResolvedValue([newest, older]);

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Newest'),
    );

    // An id not in the current day's entries: the same-day effect finds idx < 0 and no-ops,
    // leaving the signal set for a future loadEntriesForDate to consume.
    setSelectedEntryId(777);
    await flushMicrotasks();

    // Still on the newest; the target was NOT cleared by the same-day effect.
    expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Newest');
    expect(selectedEntryId()).toBe(777);
  });

  // Regression: reproduces SearchResults.tsx's handleResultClick exactly — a click on a
  // same-day search result sets the deep-link id, which synchronously fires the same-day
  // effect above (→ navigateToEntry → canLeaveCurrentEntry), and then — without awaiting
  // that — the click's own guarded requestDateAndViewChange calls the guard again via
  // requestNavigationConsent. Both calls used to run canLeaveCurrentEntry independently,
  // each producing its own confirmInApp() call; the second silently overwrote the first's
  // pendingResolve (confirm-dialog.ts), permanently hanging the first caller and leaving
  // the same-day navigation stuck on the just-deleted entry even though the delete itself
  // completed. The fix coalesces concurrent callers (useEntryLifecycle.ts's
  // `leaveCheckInFlight`) so this now shows one dialog and completes the navigation.
  it('same-day deep-link raced with a concurrent guard call shows exactly one dialog and completes the navigation', async () => {
    const newest = makeEntry({ id: 20, title: 'Newest', text: '<p>Newest</p>' });
    const older = makeEntry({ id: 10, title: 'Older', text: '<p>Older</p>' });
    mocks.getEntriesForDate
      .mockResolvedValueOnce([newest, older]) // initial load
      .mockResolvedValueOnce([older]); // refresh after the confirmed delete
    mocks.entryHasContent.mockResolvedValue(true); // on-disk row still has the old content
    mocks.confirm.mockResolvedValue(true); // user confirms

    renderWithI18n(() => <EditorPanel />);
    await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
    await flushMicrotasks();
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Newest'),
    );

    // Erase the open entry's content, as a real search-result click would find it.
    fireEvent.input(screen.getByTestId('title-input'), { target: { value: '' } });
    typeIntoEditor('<p></p>');
    await flushMicrotasks();

    // The race: set the deep-link target, then — without awaiting the effect it triggers —
    // call the same guard a second, concurrent time, exactly as handleResultClick's own
    // requestDateAndViewChange does.
    setSelectedEntryId(10);
    const guardResult = requestNavigationConsent();

    await waitFor(() => expect(mocks.deleteEntry).toHaveBeenCalledWith(20));
    expect(await guardResult).toBe(true);

    // Exactly one dialog for the one user action, not one orphaned per concurrent caller.
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    // The same-day effect's own navigateToEntry call must have actually completed — not
    // hung awaiting a never-resolving confirmInApp promise — landing on the deep-link
    // target rather than staying stuck on the just-deleted entry.
    await waitFor(() =>
      expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Older'),
    );
    expect(selectedEntryId()).toBeNull();
  });

  it('focus-on-unlock: does not focus an editor destroyed between scheduling and the frame', async () => {
    // Regression: the auto-focus effect schedules a requestAnimationFrame, but a lock
    // can tear the editor down before the frame fires (resetting hasFocusedEditorOnUnlock
    // re-runs the effect, then the teardown nulls TipTap's commandManager). Calling
    // ed.commands.focus() on that destroyed editor threw
    // "null is not an object (evaluating 'this.commandManager.commands')".
    const rafQueue: FrameRequestCallback[] = [];
    const realRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    }) as typeof globalThis.requestAnimationFrame;
    const flushFrames = () => {
      const pending = rafQueue.splice(0);
      pending.forEach((cb) => cb(0));
    };

    try {
      mocks.getEntriesForDate.mockResolvedValue([]);
      renderWithI18n(() => <EditorPanel />);
      await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
      await flushMicrotasks();

      // The first (legitimate) auto-focus frame fires while the editor is alive.
      flushFrames();
      await flushMicrotasks();
      expect(bus.mockEditor.isDestroyed).toBe(false);

      // Swap in a spy and simulate a lock: the flag reset re-runs the effect, which
      // passes the synchronous guard (editor still alive) and schedules a frame.
      const focusSpy = vi.fn();
      bus.mockEditor.commands.focus = focusSpy;
      setHasFocusedEditorOnUnlock(false);
      await flushMicrotasks();
      expect(rafQueue.length).toBeGreaterThan(0);

      // Teardown happens after the frame is queued but before it runs.
      bus.mockEditor.isDestroyed = true;
      flushFrames();

      // The re-check inside the frame must skip focus on the destroyed editor.
      expect(focusSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.requestAnimationFrame = realRaf;
    }
  });
});
