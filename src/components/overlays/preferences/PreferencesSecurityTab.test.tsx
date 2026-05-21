import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import { PreferencesShellContext } from './shared';
import PreferencesSecurityTab from './PreferencesSecurityTab';

const { mockPeekAuthSlotTypes } = vi.hoisted(() => ({
  mockPeekAuthSlotTypes: vi.fn(() => Promise.resolve({ slots: [], require_all_auth: false })),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    peekAuthSlotTypes: mockPeekAuthSlotTypes,
    changePassword: vi.fn(() => Promise.resolve()),
    verifyPassword: vi.fn(() => Promise.resolve()),
    generateKeypair: vi.fn(() =>
      Promise.resolve({ public_key_hex: 'aabb', private_key_hex: 'ccdd' }),
    ),
    registerKeypair: vi.fn(() => Promise.resolve()),
    writeKeyFile: vi.fn(() => Promise.resolve()),
    registerPassword: vi.fn(() => Promise.resolve()),
    removeAuthMethod: vi.fn(() => Promise.resolve()),
  };
});

const { mockAuthMethods, mockAuthState, mockLoadAuthMethods } = vi.hoisted(() => ({
  mockAuthMethods: vi.fn(
    () => [] as { id: number; slot_type: string; label: string; last_used: string | null }[],
  ),
  mockAuthState: vi.fn(() => 'unlocked' as const),
  mockLoadAuthMethods: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../state/auth', () => ({
  authState: mockAuthState,
  authMethods: mockAuthMethods,
  loadAuthMethods: mockLoadAuthMethods,
  setRequireAllAuth: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../state/journals', () => ({
  journals: vi.fn(() => []),
  activeJournalId: vi.fn(() => null),
}));

vi.mock('../../../state/preferences', () => ({
  preferences: vi.fn(() => ({ autoLockEnabled: false, autoLockTimeout: 300 })),
  setPreferences: vi.fn(),
}));

function renderTab() {
  const [isOpen] = createSignal(true);
  return renderWithI18n(() => (
    <PreferencesShellContext.Provider
      value={{
        registerCommit: vi.fn((_fn: () => void) => {
          return () => {};
        }),
      }}
    >
      <PreferencesSecurityTab isOpen={isOpen} onClose={vi.fn()} />
    </PreferencesShellContext.Provider>
  ));
}

describe('PreferencesSecurityTab — conditional sections', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows Change Password section when a password slot is registered', () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
    ]);
    renderTab();
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add Password Auth' })).not.toBeInTheDocument();
  });

  it('shows Add Password section when no password slot is registered', () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderTab();
    expect(screen.getByRole('heading', { name: 'Add Password Auth' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Change Password' })).not.toBeInTheDocument();
  });
});
