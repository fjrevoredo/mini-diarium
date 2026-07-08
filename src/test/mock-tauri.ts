import { vi } from 'vitest';

/**
 * Shared helper for mocking the Tauri command barrel (`src/lib/tauri`).
 *
 * The barrel re-exports many typed `invoke()` wrappers. Tests that need to stub
 * one or two of them while keeping the rest real were repeating this factory:
 *
 * ```ts
 * vi.mock('../../lib/tauri', async () => {
 *   const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
 *   return { ...actual, getTimelineEntries: mocks.getTimelineEntries };
 * });
 * ```
 *
 * `mockTauriBarrel` collapses the body to a single call. Wrap it in the mock
 * factory arrow so the helper is invoked lazily (after this module's imports are
 * initialised) rather than eagerly at the hoisted `vi.mock` call site:
 *
 * ```ts
 * const mocks = vi.hoisted(() => ({ getTimelineEntries: vi.fn() }));
 * vi.mock('../../lib/tauri', () => mockTauriBarrel({ getTimelineEntries: mocks.getTimelineEntries }));
 * ```
 *
 * Because `vi.mock` is hoisted, the mock functions passed in `overrides` must be
 * created with `vi.hoisted(...)`. The `../lib/tauri` path in `importActual` is
 * resolved relative to this file (`src/test/`), so it always points at the real
 * barrel regardless of where the calling test lives.
 */
type TauriBarrel = typeof import('../lib/tauri');

export async function mockTauriBarrel(overrides: Partial<TauriBarrel>): Promise<TauriBarrel> {
  const actual = await vi.importActual<TauriBarrel>('../lib/tauri');
  return { ...actual, ...overrides };
}
