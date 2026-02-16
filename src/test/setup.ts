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
global.window = global.window || {};
(global.window as any).__TAURI_INTERNALS__ = {
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
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  open: vi.fn(() => Promise.resolve()),
}));
