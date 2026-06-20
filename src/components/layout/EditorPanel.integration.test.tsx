/* eslint-disable solid/reactivity -- intentional test shim, not a reactive component */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import type { DiaryEntry } from '../../lib/tauri';

/**
 * Integration tests for EditorPanel covering the four flows called out in the
 * M6 review: load-then-type, switch-day-while-unsaved, delete-empty-on-nav,
 * create-on-first-keystroke.
 *
 * TipTap refuses to mount in jsdom, so `DiaryEditor` is replaced with a minimal
 * shim that honours `content`, `onUpdate`, `onSetContent`, and `onEditorReady`.
 * A shared `editorBus` lets tests synchronously drive callbacks the way TipTap
 * would in the real app.
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
      state: { doc: { descendants: () => void } };
    },
  };
  return state;
});

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  saveEntry: vi.fn(),
  deleteEntry: vi.fn(),
  deleteEntryIfEmpty: vi.fn(),
  getEntriesForDate: vi.fn(),
  getAllEntryDates: vi.fn(),
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
    getEntriesForDate: mocks.getEntriesForDate,
    getAllEntryDates: mocks.getAllEntryDates,
    readTextFile: mocks.readTextFile,
  };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mocks.open,
  confirm: mocks.confirm,
}));

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
        isEmpty: !props.content || props.content === '<p></p>',
        isDestroyed: false,
        getHTML: () => bus.lastContent,
        getText: () => {
          // Strip angle brackets for a rough text representation.
          return bus.lastContent.replace(/[<>]/g, '');
        },
        commands: {
          setContent: (html: string) => {
            bus.lastContent = html;
            editor.isEmpty = !html || html === '<p></p>';
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
        state: { doc: { descendants: () => {} } },
      };
      bus.mockEditor = editor;
      bus.lastContent = props.content;
      props.onEditorReady?.(editor);
      return <div data-testid="diary-editor-shim">{props.content}</div>;
    },
  };
});

// ── Import-after-mock ─────────────────────────────────────────────────────────

import EditorPanel from './EditorPanel';
import { setSelectedDate } from '../../state/ui';
import { setIsSaving } from '../../state/entries';
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
    mocks.saveEntry.mockResolvedValue(undefined);
    mocks.deleteEntryIfEmpty.mockResolvedValue(true);
    mocks.deleteEntry.mockResolvedValue(undefined);
    mocks.confirm.mockResolvedValue(true);
    setSelectedDate('2026-04-23');
    // Session flag is module-global; reset so each test starts pre-focus.
    setHasFocusedEditorOnUnlock(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    setIsSaving(false);
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
    await waitFor(() => {
      expect(mocks.deleteEntryIfEmpty).toHaveBeenCalledWith(11, '', '');
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
