import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';

const { mockListen } = vi.hoisted(() => ({
  mockListen: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

const { mockIsDialogOpen } = vi.hoisted(() => ({
  mockIsDialogOpen: vi.fn(() => false),
}));

vi.mock('./dialog', () => ({
  isDialogOpen: mockIsDialogOpen,
}));

import { createFocusLossAutoLock } from './focus-lock';

type Handler = () => void;

// Debounce interval used across tests — short enough to keep the suite fast
// while still exercising real setTimeout/clearTimeout behavior (no fake timers).
const TEST_DEBOUNCE_MS = 20;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockListenCapturing(): {
  getHandler: (event: string) => Handler | undefined;
  getUnlisten: (event: string) => ReturnType<typeof vi.fn> | undefined;
} {
  const handlers: Record<string, Handler> = {};
  const unlistens: Record<string, ReturnType<typeof vi.fn>> = {};
  mockListen.mockImplementation(async (event: string, callback: Handler) => {
    handlers[event] = callback;
    const unlisten = vi.fn();
    unlistens[event] = unlisten;
    return unlisten;
  });
  return {
    getHandler: (event: string) => handlers[event],
    getUnlisten: (event: string) => unlistens[event],
  };
}

afterEach(() => {
  vi.clearAllMocks();
  mockIsDialogOpen.mockReturnValue(false);
});

describe('createFocusLossAutoLock', () => {
  it('does nothing when enabled() is false', () => {
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({ enabled: () => false, isUnlocked: () => true, lock });
      return dispose;
    });

    expect(mockListen).not.toHaveBeenCalled();
    dispose();
  });

  it('never registers listeners when isUnlocked() is already false', () => {
    mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({ enabled: () => true, isUnlocked: () => false, lock });
      return dispose;
    });

    expect(mockListen).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
    dispose();
  });

  it('registers listeners for both window-unfocused and window-focused', async () => {
    const { getHandler } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({ enabled: () => true, isUnlocked: () => true, lock });
      return dispose;
    });

    await vi.waitFor(() => {
      expect(getHandler('window-unfocused')).toBeDefined();
      expect(getHandler('window-focused')).toBeDefined();
    });
    expect(mockListen).toHaveBeenCalledWith('window-unfocused', expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith('window-focused', expect.any(Function));
    dispose();
  });

  it('does not call lock() immediately on window-unfocused — waits for the debounce', async () => {
    const { getHandler } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: () => true,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    getHandler('window-unfocused')!();

    expect(lock).not.toHaveBeenCalled();

    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('cancels the pending lock if window-focused fires before the debounce elapses (misclick)', async () => {
    const { getHandler } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: () => true,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    getHandler('window-unfocused')!();
    getHandler('window-focused')!();

    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).not.toHaveBeenCalled();
    dispose();
  });

  it('does not call lock() while isDialogOpen() stays true, but locks once it becomes false (reschedule)', async () => {
    const { getHandler } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: () => true,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    mockIsDialogOpen.mockReturnValue(true);
    getHandler('window-unfocused')!();

    // Still open — the check reschedules itself rather than abandoning the lock.
    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).not.toHaveBeenCalled();

    // Dialog closes (or the suppression window elapses) — the next reschedule locks.
    mockIsDialogOpen.mockReturnValue(false);
    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('reschedules across several consecutive isDialogOpen()===true cycles and locks exactly once', async () => {
    const { getHandler } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: () => true,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    mockIsDialogOpen.mockReturnValue(true);
    getHandler('window-unfocused')!();

    // Several reschedule cycles while still "open".
    await wait(TEST_DEBOUNCE_MS * 5);
    expect(lock).not.toHaveBeenCalled();

    mockIsDialogOpen.mockReturnValue(false);
    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('resets the debounce (does not double-schedule) when window-unfocused fires twice in succession', async () => {
    const { getHandler } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: () => true,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    getHandler('window-unfocused')!();
    getHandler('window-unfocused')!();

    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('checks isUnlocked() again when the debounce fires, in case it changed during the wait', async () => {
    const { getHandler } = mockListenCapturing();
    const [unlocked, setUnlocked] = createSignal(true);
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: unlocked,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    getHandler('window-unfocused')!();
    setUnlocked(false);

    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).not.toHaveBeenCalled();
    dispose();
  });

  it('clears the pending debounce and calls both unlisten fns after the reactive root is disposed', async () => {
    const { getHandler, getUnlisten } = mockListenCapturing();
    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({
        enabled: () => true,
        isUnlocked: () => true,
        lock,
        debounceMs: TEST_DEBOUNCE_MS,
      });
      return dispose;
    });

    await vi.waitFor(() => expect(getHandler('window-unfocused')).toBeDefined());
    getHandler('window-unfocused')!();
    dispose();

    await wait(TEST_DEBOUNCE_MS * 2);
    expect(lock).not.toHaveBeenCalled();
    expect(getUnlisten('window-unfocused')).toHaveBeenCalledTimes(1);
    expect(getUnlisten('window-focused')).toHaveBeenCalledTimes(1);
  });

  it('calls unlisten immediately for both events if disposed before listen() resolves', async () => {
    const unlistenUnfocused = vi.fn();
    const unlistenFocused = vi.fn();
    const resolvers: Record<string, (fn: () => void) => void> = {};
    mockListen.mockImplementation(
      (event: string) =>
        new Promise<() => void>((resolve) => {
          resolvers[event] = resolve;
        }),
    );

    const lock = vi.fn();
    const dispose = createRoot((dispose) => {
      createFocusLossAutoLock({ enabled: () => true, isUnlocked: () => true, lock });
      return dispose;
    });

    dispose();
    resolvers['window-unfocused'](unlistenUnfocused);
    resolvers['window-focused'](unlistenFocused);

    await vi.waitFor(() => {
      expect(unlistenUnfocused).toHaveBeenCalledTimes(1);
      expect(unlistenFocused).toHaveBeenCalledTimes(1);
    });
  });
});
