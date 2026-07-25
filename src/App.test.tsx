import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';
import { renderWithI18n } from './test/i18n-test-utils';
import type { AuthState } from './state/auth';
import type { Preferences } from './state/preferences';
import App from './App';

type MinimalPreferences = Pick<
  Preferences,
  'language' | 'autoLockEnabled' | 'autoLockTimeout' | 'autoLockOnFocusLoss' | 'enableSpellcheck'
>;

const DEFAULT_PREFERENCES: MinimalPreferences = {
  language: 'en',
  autoLockEnabled: false,
  autoLockTimeout: 300,
  autoLockOnFocusLoss: false,
  enableSpellcheck: true,
};

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
  mockPreferences: vi.fn<() => MinimalPreferences>(),
}));

vi.mock('./state/preferences', () => ({
  preferences: mockPreferences,
}));

// Back the mocked `preferences()` with a real signal so App's createEffects re-run when a
// test changes a preference — a plain `mockReturnValue` is invisible to SolidJS tracking.
// Handing the accessor itself to the mock is the point: App calls it from inside its own
// createEffects, so tracking happens there rather than at this module-level reference.
const [preferenceState, setPreferenceState] = createSignal(DEFAULT_PREFERENCES);
// eslint-disable-next-line solid/reactivity
mockPreferences.mockImplementation(preferenceState);

vi.mock('./lib/theme', () => ({
  initializeTheme: vi.fn(),
}));

vi.mock('./state/notifications', () => ({
  loadNotifications: vi.fn(() => Promise.resolve()),
}));

const { mockSetSpellcheckEnabled } = vi.hoisted(() => ({
  mockSetSpellcheckEnabled: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/tauri', () => ({
  updateMenuLocale: vi.fn(() => Promise.resolve()),
  setSpellcheckEnabled: mockSetSpellcheckEnabled,
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

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState.mockReturnValue('checking');
  setPreferenceState(DEFAULT_PREFERENCES);
});

describe('App — focus-loss auto-lock wiring (TODO-0068)', () => {
  it('calls createFocusLossAutoLock once with accessors proxying preferences and auth state', () => {
    renderWithI18n(() => <App />);

    expect(mockCreateFocusLossAutoLock).toHaveBeenCalledTimes(1);
    const options = mockCreateFocusLossAutoLock.mock.calls[0][0];

    setPreferenceState({ ...DEFAULT_PREFERENCES, autoLockOnFocusLoss: true });
    expect(options.enabled()).toBe(true);

    setPreferenceState({ ...DEFAULT_PREFERENCES, autoLockOnFocusLoss: false });
    expect(options.enabled()).toBe(false);

    mockAuthState.mockReturnValue('unlocked');
    expect(options.isUnlocked()).toBe(true);

    mockAuthState.mockReturnValue('locked');
    expect(options.isUnlocked()).toBe(false);

    options.lock();
    expect(mockLockJournal).toHaveBeenCalledTimes(1);
  });
});

describe('App — spellcheck wiring (TODO-0081, issue #227)', () => {
  it('pushes the current preference and UI language to the backend on mount', () => {
    setPreferenceState({ ...DEFAULT_PREFERENCES, enableSpellcheck: true, language: 'de' });

    renderWithI18n(() => <App />);

    expect(mockSetSpellcheckEnabled).toHaveBeenCalledTimes(1);
    expect(mockSetSpellcheckEnabled).toHaveBeenCalledWith(true, 'de');
  });

  it('re-applies when the preference is toggled off', () => {
    renderWithI18n(() => <App />);
    expect(mockSetSpellcheckEnabled).toHaveBeenCalledWith(true, 'en');

    setPreferenceState({ ...DEFAULT_PREFERENCES, enableSpellcheck: false });

    expect(mockSetSpellcheckEnabled).toHaveBeenCalledTimes(2);
    expect(mockSetSpellcheckEnabled).toHaveBeenLastCalledWith(false, 'en');
  });

  it('re-applies when the UI language changes', () => {
    renderWithI18n(() => <App />);

    setPreferenceState({ ...DEFAULT_PREFERENCES, language: 'pt-BR' });

    expect(mockSetSpellcheckEnabled).toHaveBeenLastCalledWith(true, 'pt-BR');
  });
});
