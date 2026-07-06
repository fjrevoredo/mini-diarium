import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
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

const { mockAuthMethods, mockAuthState, mockLoadAuthMethods, mockSetRequireAllAuth } = vi.hoisted(
  () => ({
    mockAuthMethods: vi.fn(
      () => [] as { id: number; slot_type: string; label: string; last_used: string | null }[],
    ),
    mockAuthState: vi.fn(() => 'unlocked' as const),
    mockLoadAuthMethods: vi.fn(() => Promise.resolve()),
    mockSetRequireAllAuth: vi.fn(() => Promise.resolve()),
  }),
);

vi.mock('../../../state/auth', () => ({
  authState: mockAuthState,
  authMethods: mockAuthMethods,
  loadAuthMethods: mockLoadAuthMethods,
  setRequireAllAuth: mockSetRequireAllAuth,
}));

const { mockJournals, mockActiveJournalId } = vi.hoisted(() => ({
  mockJournals: vi.fn(
    () => [] as { id: number; name: string; path: string; auto_protected?: boolean }[],
  ),
  mockActiveJournalId: vi.fn(() => null as number | null),
}));

vi.mock('../../../state/journals', () => ({
  journals: mockJournals,
  activeJournalId: mockActiveJournalId,
}));

const { mockPreferences, mockSetPreferences } = vi.hoisted(() => ({
  mockPreferences: vi.fn(() => ({
    autoLockEnabled: false,
    autoLockTimeout: 300,
    autoLockOnFocusLoss: false,
  })),
  mockSetPreferences: vi.fn(),
}));

vi.mock('../../../state/preferences', () => ({
  preferences: mockPreferences,
  setPreferences: mockSetPreferences,
  MIN_AUTO_LOCK_TIMEOUT: 5,
  MAX_AUTO_LOCK_TIMEOUT: 999,
}));

function renderTab() {
  const [isOpen] = createSignal(true);
  return renderWithI18n(() => <PreferencesSecurityTab isOpen={isOpen} onClose={vi.fn()} />);
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

describe('PreferencesSecurityTab — require-all-auth toggle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows fallback text when fewer than two non-auto methods are registered', () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
    ]);
    renderTab();
    expect(
      screen.getByText('Add at least two authentication methods to enable this option.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /require all authentication/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the checkbox when two or more non-auto methods are registered', () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderTab();
    expect(
      screen.getByRole('checkbox', { name: /require all authentication/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Add at least two authentication methods to enable this option.'),
    ).not.toBeInTheDocument();
  });

  it('hides the require-all-auth section for auto-protected journals', () => {
    mockJournals.mockReturnValue([
      { id: 1, name: 'My Journal', path: '/tmp', auto_protected: true },
    ]);
    mockActiveJournalId.mockReturnValue(1);
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderTab();
    expect(
      screen.queryByRole('heading', { name: 'Require All Authentication Methods' }),
    ).not.toBeInTheDocument();
  });

  it('initialises checkbox as checked when peekAuthSlotTypes returns require_all_auth: true', async () => {
    mockJournals.mockReturnValue([]);
    mockActiveJournalId.mockReturnValue(null);
    mockPeekAuthSlotTypes.mockResolvedValueOnce({ slots: [], require_all_auth: true });
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /require all authentication/i });
    await vi.waitFor(() => {
      expect(checkbox).toBeChecked();
    });
  });

  it('calls setRequireAllAuth with the new value when the checkbox is toggled', async () => {
    mockJournals.mockReturnValue([]);
    mockActiveJournalId.mockReturnValue(null);
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /require all authentication/i });
    fireEvent.click(checkbox);
    await vi.waitFor(() => {
      expect(mockSetRequireAllAuth).toHaveBeenCalledWith(true);
    });
  });

  it('displays a sanitised error when setRequireAllAuth rejects', async () => {
    mockJournals.mockReturnValue([]);
    mockActiveJournalId.mockReturnValue(null);
    mockSetRequireAllAuth.mockRejectedValueOnce(new Error('Journal must be unlocked'));
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /require all authentication/i });
    fireEvent.click(checkbox);
    await vi.waitFor(() => {
      expect(screen.getByText('Please unlock your journal first.')).toBeInTheDocument();
    });
  });
});

describe('PreferencesSecurityTab — auto-lock immediate persistence', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
  });

  it('renders the auto-lock checkbox unchecked by default', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /lock after inactivity/i });
    expect(checkbox).not.toBeChecked();
  });

  it('renders the auto-lock checkbox checked when preferences.autoLockEnabled is true', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: true,
      autoLockTimeout: 60,
      autoLockOnFocusLoss: false,
    });
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /lock after inactivity/i });
    expect(checkbox).toBeChecked();
  });

  it('persists autoLockEnabled immediately when toggled', () => {
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /lock after inactivity/i });
    fireEvent.click(checkbox);
    expect(mockSetPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ autoLockEnabled: true }),
    );
  });

  it('persists valid timeout input immediately', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: true,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();

    const timeoutInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(timeoutInput, { target: { value: '120' } });

    expect(mockSetPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ autoLockTimeout: 120 }),
    );
  });

  it('clamps timeout to 999 on blur for out-of-range input', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: true,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();

    const timeoutInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(timeoutInput, { target: { value: '1000' } });
    fireEvent.blur(timeoutInput, { target: { value: '1000' } });

    expect(mockSetPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ autoLockTimeout: 999 }),
    );
  });

  it('clamps timeout to 5 on blur for below-minimum input', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: true,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();

    const timeoutInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(timeoutInput, { target: { value: '2' } });
    fireEvent.blur(timeoutInput, { target: { value: '2' } });

    expect(mockSetPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ autoLockTimeout: 5 }),
    );
  });

  it('shows an inline warning while typing a below-minimum value and clears it after blur', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: true,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();

    const timeoutInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(timeoutInput, { target: { value: '2' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.blur(timeoutInput, { target: { value: '2' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PreferencesSecurityTab — auto-lock on focus loss (TODO-0068)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
  });

  it('renders the focus-loss checkbox unchecked by default', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /lock when the window loses focus/i });
    expect(checkbox).not.toBeChecked();
  });

  it('renders the focus-loss checkbox checked when preferences.autoLockOnFocusLoss is true', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: true,
    });
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /lock when the window loses focus/i });
    expect(checkbox).toBeChecked();
  });

  it('calls setPreferences({ autoLockOnFocusLoss: true }) when clicked', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();
    const checkbox = screen.getByRole('checkbox', { name: /lock when the window loses focus/i });
    fireEvent.click(checkbox);
    expect(mockSetPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ autoLockOnFocusLoss: true }),
    );
  });

  it('renders even when autoLockEnabled is false, proving independence from the idle timer', () => {
    mockPreferences.mockReturnValue({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      autoLockOnFocusLoss: false,
    });
    renderTab();
    expect(
      screen.getByRole('checkbox', { name: /lock when the window loses focus/i }),
    ).toBeInTheDocument();
  });
});
