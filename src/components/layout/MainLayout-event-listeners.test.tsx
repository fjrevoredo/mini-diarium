import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';

/**
 * Test to verify the event listener pattern used in MainLayout.tsx
 *
 * This tests the core issue: Are the Tauri event listeners being set up correctly?
 */
describe('MainLayout Event Listener Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call the accessor function when event handler fires', async () => {
    const [selectedDate, setSelectedDate] = createSignal('2024-01-15');

    let capturedDate: string | null = null;

    // Simulate the event listener pattern from MainLayout.tsx
    const eventHandler = async () => {
      // This is what MainLayout does - call the accessor inside the handler
      capturedDate = selectedDate();
    };

    // User changes the date
    setSelectedDate('2024-01-20');

    // Menu event fires
    await eventHandler();

    // The handler should get the CURRENT date, not the initial one
    expect(capturedDate).toBe('2024-01-20');
  });

  it('should demonstrate Tauri listen() returns a Promise', async () => {
    // The issue might be that listen() is async and returns a Promise<UnlistenFn>
    // If we await it in onMount, it should work, but let's verify the pattern

    const mockListen = vi.fn(async (_event: string, _handler: () => void) => {
      // Simulate Tauri's listen() which returns a Promise<UnlistenFn>
      return () => {}; // Unlisten function
    });

    // This is how MainLayout sets up listeners
    const unlisteners: Array<() => void> = [];

    // This should work - await the listen call and push the unlisten function
    const unlisten = await mockListen('test-event', () => {});
    unlisteners.push(unlisten);

    expect(mockListen).toHaveBeenCalledWith('test-event', expect.any(Function));
    expect(unlisteners).toHaveLength(1);
  });

  it('should check if listen is being called in onMount context correctly', async () => {
    // Simulating the onMount pattern
    let listenerFunction: (() => void) | null = null;

    const mockListen = vi.fn(async (_event: string, handler: () => void) => {
      listenerFunction = handler; // Capture the handler
      return () => {}; // Return unlisten function
    });

    // Simulate onMount setup
    const setupListeners = async () => {
      const unlisteners: Array<() => void> = [];

      // This mimics MainLayout.tsx line 49-57
      unlisteners.push(
        await mockListen('menu-navigate-previous-day', async () => {
          console.log('Handler called!');
        }),
      );

      return unlisteners;
    };

    const unlisteners = await setupListeners();

    // Verify the listener was registered
    expect(mockListen).toHaveBeenCalled();
    expect(listenerFunction).toBeTruthy();
    expect(unlisteners).toHaveLength(1);
  });
});

/**
 * Check if there's an issue with async handlers in SolidJS onMount
 */
describe('SolidJS onMount with Async', () => {
  it('should demonstrate async onMount pattern', async () => {
    // SolidJS onMount can be async, but we need to verify the pattern is correct
    let setupComplete = false;

    const simulateOnMount = async () => {
      // Simulate async setup like in MainLayout
      await Promise.resolve(); // Simulate async operation
      setupComplete = true;
    };

    await simulateOnMount();

    expect(setupComplete).toBe(true);
  });
});
