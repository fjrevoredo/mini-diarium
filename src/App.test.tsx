import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderWithI18n } from './test/i18n-test-utils';
import type { AuthState } from './state/auth';
import type { Preferences } from './state/preferences';
import App from './App';

type MinimalPreferences = Pick<
  Preferences,
  'language' | 'autoLockEnabled' | 'autoLockTimeout' | 'autoLockOnFocusLoss'
>;

const { mockAuthState, mockInitializeAuth, mockLockJournal, mockSetupAuthEventListeners } =
  vi.hoisted(() => ({
    mockAuthState: vi.fn<() => AuthState>(() => 'checking'),
    mockInitializeAuth: vi.fn(),
    mockLockJournal: vi.fn(() => Promise.resolve()),
    mockSetupAuthEventListeners: vi.fn(() => Promise.resolve(() => {})),
  }));

vi.mock('./state/auth', () => ({
  authState: mockAuthState,
  initializeAuth: mockInitializeAuth,
  lockJournal: mockLockJournal,
  setupAuthEventListeners: mockSetupAuthEventListeners,
}));

const { mockPreferences } = vi.hoisted(() => ({
  mockPreferences: vi.fn<() => MinimalPreferences>(() => ({
    language: 'en',
    autoLockEnabled: false,
    autoLockTimeout: 300,
    autoLockOnFocusLoss: false,
  })),
}));

vi.mock('./state/preferences', () => ({
  preferences: mockPreferences,
}));

vi.mock('./lib/theme', () => ({
  initializeTheme: vi.fn(),
}));

vi.mock('./state/notifications', () => ({
  loadNotifications: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/tauri', () => ({
  updateMenuLocale: vi.fn(() => Promise.resolve()),
}));

const { mockCreateFocusLossAutoLock } = vi.hoisted(() => ({
  mockCreateFocusLossAutoLock: vi.fn(),
}));

vi.mock('./lib/focus-lock', () => ({
  createFocusLossAutoLock: mockCreateFocusLossAutoLock,
}));

// Stub out the heavy per-authState screens. App.tsx imports these eagerly (ES module
// imports are evaluated regardless of which <Match> branch renders), which would
// otherwise pull their entire real subtree — MainLayout's full app shell included —
// into this file's coverage instrumentation even though this test only exercises the
// 'checking' branch. Mocking them keeps this a thin wiring test for App.tsx itself.
vi.mock('./components/auth/JournalPicker', () => ({ default: () => null }));
vi.mock('./components/auth/PasswordCreation', () => ({ default: () => null }));
vi.mock('./components/auth/PasswordPrompt', () => ({ default: () => null }));
vi.mock('./components/layout/MainLayout', () => ({ default: () => null }));
vi.mock('./components/overlays/AboutOverlay', () => ({ default: () => null }));

describe('App — focus-loss auto-lock wiring (TODO-0068)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockAuthState.mockReturnValue('checking');
    mockPreferences.mockReturnValue({
      language: 'en',
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
  });

  it('calls createFocusLossAutoLock once with accessors proxying preferences and auth state', () => {
    renderWithI18n(() => <App />);

    expect(mockCreateFocusLossAutoLock).toHaveBeenCalledTimes(1);
    const options = mockCreateFocusLossAutoLock.mock.calls[0][0];

    mockPreferences.mockReturnValue({
      language: 'en',
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: true,
    });
    expect(options.enabled()).toBe(true);

    mockPreferences.mockReturnValue({
      language: 'en',
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    expect(options.enabled()).toBe(false);

    mockAuthState.mockReturnValue('unlocked');
    expect(options.isUnlocked()).toBe(true);

    mockAuthState.mockReturnValue('locked');
    expect(options.isUnlocked()).toBe(false);

    options.lock();
    expect(mockLockJournal).toHaveBeenCalledTimes(1);
  });
});
