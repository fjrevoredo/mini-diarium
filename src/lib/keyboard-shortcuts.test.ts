import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerKeyboardShortcuts } from './keyboard-shortcuts';
import {
  resetUiState,
  isGoToDateOpen,
  isSearchOpen,
  setIsStatsOpen,
  setIsImagePickerOpen,
  selectedDate,
  setSelectedDate,
} from '../state/ui';
import { setPreferences } from '../state/preferences';

const {
  mockNavigatePreviousDay,
  mockNavigateNextDay,
  mockNavigateToToday,
  mockNavigatePreviousMonth,
  mockNavigateNextMonth,
} = vi.hoisted(() => ({
  mockNavigatePreviousDay: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateNextDay: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateToToday: vi.fn<() => Promise<string>>(),
  mockNavigatePreviousMonth: vi.fn<(currentDate: string) => Promise<string>>(),
  mockNavigateNextMonth: vi.fn<(currentDate: string) => Promise<string>>(),
}));

vi.mock('./tauri', async () => {
  const actual = await vi.importActual<typeof import('./tauri')>('./tauri');
  return {
    ...actual,
    navigatePreviousDay: mockNavigatePreviousDay,
    navigateNextDay: mockNavigateNextDay,
    navigateToToday: mockNavigateToToday,
    navigatePreviousMonth: mockNavigatePreviousMonth,
    navigateNextMonth: mockNavigateNextMonth,
  };
});

let unregister: () => void;

/** Dispatch a keydown on `document` and report whether the handler consumed it. */
function press(init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent('keydown', { ...init, cancelable: true, bubbles: true });
  document.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Let the awaited navigation wrappers settle before asserting on `selectedDate`. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetUiState();
  setPreferences({ allowFutureEntries: true });
  setSelectedDate('2024-01-15');
  mockNavigatePreviousDay.mockResolvedValue('2024-01-14');
  mockNavigateNextDay.mockResolvedValue('2024-01-16');
  mockNavigateToToday.mockResolvedValue('2026-07-25');
  mockNavigatePreviousMonth.mockResolvedValue('2023-12-15');
  mockNavigateNextMonth.mockResolvedValue('2024-02-15');
  unregister = registerKeyboardShortcuts();
});

afterEach(() => {
  unregister();
  vi.clearAllMocks();
});

describe('keyboard-shortcuts', () => {
  it('Mod+[ navigates to the previous day', async () => {
    expect(press({ key: '[', code: 'BracketLeft', ctrlKey: true })).toBe(true);
    await flush();

    expect(mockNavigatePreviousDay).toHaveBeenCalledWith('2024-01-15');
    expect(selectedDate()).toBe('2024-01-14');
  });

  it('Mod+] navigates to the next day', async () => {
    expect(press({ key: ']', code: 'BracketRight', ctrlKey: true })).toBe(true);
    await flush();

    expect(mockNavigateNextDay).toHaveBeenCalledWith('2024-01-15');
    expect(selectedDate()).toBe('2024-01-16');
  });

  // With Shift held, `e.key` is '{' on a US layout — matching on e.key would miss this
  // entirely and fall through to the day shortcut.
  it('Mod+Shift+[ navigates to the previous month, matching on e.code', async () => {
    expect(press({ key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true })).toBe(true);
    await flush();

    expect(mockNavigatePreviousMonth).toHaveBeenCalledWith('2024-01-15');
    expect(mockNavigatePreviousDay).not.toHaveBeenCalled();
    expect(selectedDate()).toBe('2023-12-15');
  });

  it('Mod+Shift+] navigates to the next month, matching on e.code', async () => {
    expect(press({ key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true })).toBe(true);
    await flush();

    expect(mockNavigateNextMonth).toHaveBeenCalledWith('2024-01-15');
    expect(mockNavigateNextDay).not.toHaveBeenCalled();
    expect(selectedDate()).toBe('2024-02-15');
  });

  it('Mod+T jumps to today', async () => {
    expect(press({ key: 't', code: 'KeyT', ctrlKey: true })).toBe(true);
    await flush();

    expect(mockNavigateToToday).toHaveBeenCalledTimes(1);
    expect(selectedDate()).toBe('2026-07-25');
  });

  it('Mod+G opens the Go to Date overlay', () => {
    expect(isGoToDateOpen()).toBe(false);

    expect(press({ key: 'g', code: 'KeyG', ctrlKey: true })).toBe(true);

    expect(isGoToDateOpen()).toBe(true);
  });

  it('Mod+F opens the search overlay', () => {
    expect(isSearchOpen()).toBe(false);

    expect(press({ key: 'f', code: 'KeyF', ctrlKey: true })).toBe(true);

    expect(isSearchOpen()).toBe(true);
  });

  it('uses metaKey as the modifier too (macOS Cmd)', async () => {
    expect(press({ key: '[', code: 'BracketLeft', metaKey: true })).toBe(true);
    await flush();

    expect(mockNavigatePreviousDay).toHaveBeenCalledTimes(1);
  });

  it('ignores the bare key without a modifier', async () => {
    expect(press({ key: '[', code: 'BracketLeft' })).toBe(false);
    await flush();

    expect(mockNavigatePreviousDay).not.toHaveBeenCalled();
    expect(selectedDate()).toBe('2024-01-15');
  });

  // AltGr reports ctrlKey + altKey on Windows, and is how '[' is typed on several
  // layouts — it must reach the editor untouched.
  it('ignores Ctrl+Alt (AltGr) bracket input', async () => {
    expect(press({ key: '[', code: 'BracketLeft', ctrlKey: true, altKey: true })).toBe(false);
    await flush();

    expect(mockNavigatePreviousDay).not.toHaveBeenCalled();
  });

  it('ignores Mod+Shift on letter shortcuts', () => {
    expect(press({ key: 'g', code: 'KeyG', ctrlKey: true, shiftKey: true })).toBe(false);

    expect(isGoToDateOpen()).toBe(false);
  });

  it('fires nothing while an overlay is open', async () => {
    setIsStatsOpen(true);

    expect(press({ key: '[', code: 'BracketLeft', ctrlKey: true })).toBe(false);
    expect(press({ key: ']', code: 'BracketRight', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(press({ key: 't', code: 'KeyT', ctrlKey: true })).toBe(false);
    expect(press({ key: 'g', code: 'KeyG', ctrlKey: true })).toBe(false);
    expect(press({ key: 'f', code: 'KeyF', ctrlKey: true })).toBe(false);
    await flush();

    expect(mockNavigatePreviousDay).not.toHaveBeenCalled();
    expect(mockNavigateNextMonth).not.toHaveBeenCalled();
    expect(mockNavigateToToday).not.toHaveBeenCalled();
    expect(isGoToDateOpen()).toBe(false);
    expect(isSearchOpen()).toBe(false);
    expect(selectedDate()).toBe('2024-01-15');
  });

  // The image picker is a modal Kobalte dialog like the rest, so it must suppress
  // shortcuts too — it is the one overlay signal the pre-existing guard lists omitted.
  it('fires nothing while the image picker is open', async () => {
    setIsImagePickerOpen(true);

    expect(press({ key: '[', code: 'BracketLeft', ctrlKey: true })).toBe(false);
    await flush();

    expect(mockNavigatePreviousDay).not.toHaveBeenCalled();
    expect(selectedDate()).toBe('2024-01-15');
  });

  it('stops responding after the returned cleanup runs', async () => {
    unregister();

    expect(press({ key: '[', code: 'BracketLeft', ctrlKey: true })).toBe(false);
    await flush();

    expect(mockNavigatePreviousDay).not.toHaveBeenCalled();

    // afterEach calls unregister() again — removeEventListener is idempotent.
  });
});
