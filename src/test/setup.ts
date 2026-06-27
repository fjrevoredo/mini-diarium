import '@testing-library/jest-dom';
import { cleanup } from '@solidjs/testing-library';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Ensure DOM globals are available
if (typeof window === 'undefined') {
  throw new Error('DOM environment not available - check vitest.config.ts');
}

// Mock Tauri API
interface TauriInternals {
  invoke: () => Promise<void>;
  convertFileSrc: (src: string) => string;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

window.__TAURI_INTERNALS__ = {
  invoke: () => Promise.resolve(),
  convertFileSrc: (src: string) => src,
};

// Mock Tauri modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve(null)),
  confirm: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}));

// jsdom does not implement matchMedia; theme.ts depends on it
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Kobalte Dialog uses solid-prevent-scroll, which restores the previous scroll
// position via window.scrollTo() on cleanup. jsdom exposes the API but logs a
// noisy "Not implemented" warning for it.
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});
