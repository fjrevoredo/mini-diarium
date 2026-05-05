import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  unlockJournal: vi.fn(),
  unlockWithKeypair: vi.fn(),
  unlockAllMethods: vi.fn(),
  goToJournalPicker: vi.fn(),
  peekAuthSlotTypes: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  journals: vi.fn(() => [{ id: 'j1', name: 'My Journal', path: '/tmp' }] as any[]),
  activeJournalId: vi.fn(() => 'j1'),
}));

vi.mock('../../state/auth', () => ({
  unlockJournal: mocks.unlockJournal,
  unlockWithKeypair: mocks.unlockWithKeypair,
  unlockAllMethods: mocks.unlockAllMethods,
  goToJournalPicker: mocks.goToJournalPicker,
}));

vi.mock('../../lib/tauri', () => ({
  peekAuthSlotTypes: () => mocks.peekAuthSlotTypes(),
}));

vi.mock('../../state/journals', () => ({
  get journals() {
    return mocks.journals;
  },
  get activeJournalId() {
    return mocks.activeJournalId;
  },
}));

// ──────────────────────────────────────────────────────────────────────────────

import PasswordPrompt from './PasswordPrompt';

describe('PasswordPrompt component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.unlockJournal.mockResolvedValue(undefined);
    mocks.unlockWithKeypair.mockResolvedValue(undefined);
    mocks.unlockAllMethods.mockResolvedValue(undefined);
    mocks.peekAuthSlotTypes.mockResolvedValue({ slots: [], require_all_auth: false });
  });

  function setMultiAuthJournal() {
    mocks.journals.mockReturnValue([
      { id: 'j1', name: 'My Journal', path: '/tmp', auto_protected: false },
    ]);
    mocks.peekAuthSlotTypes.mockResolvedValue({
      slots: [
        { id: 1, slot_type: 'password', label: 'Password' },
        { id: 2, slot_type: 'keypair', label: 'My Key' },
      ],
      require_all_auth: true,
    });
  }

  it('renders password input with correct testid and type', () => {
    renderWithI18n(() => <PasswordPrompt />);

    const input = screen.getByTestId('password-unlock-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('password input has bg-primary class (dark theme regression)', () => {
    renderWithI18n(() => <PasswordPrompt />);

    const input = screen.getByTestId('password-unlock-input');
    expect(input.className).toContain('bg-primary');
  });

  it('shows error message when unlockJournal rejects', async () => {
    mocks.unlockJournal.mockRejectedValueOnce(new Error('Invalid password'));

    renderWithI18n(() => <PasswordPrompt />);

    const input = screen.getByTestId('password-unlock-input');
    fireEvent.input(input, { target: { value: 'wrongpassword' } });

    const submitButton = screen.getByTestId('unlock-journal-button');
    fireEvent.click(submitButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Invalid password')).toBeInTheDocument();
    });
  });

  it('displays the active journal name in the subtitle', () => {
    renderWithI18n(() => <PasswordPrompt />);
    expect(screen.getByText('My Journal')).toBeInTheDocument();
  });

  it('renders key-file mode when Key File tab is clicked', () => {
    renderWithI18n(() => <PasswordPrompt />);

    const keyFileTab = screen.getByText('Key File');
    fireEvent.click(keyFileTab);

    expect(screen.getByText('Private Key File')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('multi-auth: renders password and keypair inputs for mixed slots', async () => {
    setMultiAuthJournal();
    // setMultiAuthJournal already configures the mock with password + keypair slots
    renderWithI18n(() => <PasswordPrompt />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('password-unlock-input')).toBeInTheDocument();
      expect(screen.getByText('My Key')).toBeInTheDocument();
    });
  });

  it('multi-auth: renders only keypair pickers when no password slot exists', async () => {
    mocks.journals.mockReturnValue([
      { id: 'j1', name: 'My Journal', path: '/tmp', auto_protected: false },
    ]);
    mocks.peekAuthSlotTypes.mockResolvedValue({
      slots: [
        { id: 2, slot_type: 'keypair', label: 'Key A' },
        { id: 3, slot_type: 'keypair', label: 'Key B' },
      ],
      require_all_auth: true,
    });
    renderWithI18n(() => <PasswordPrompt />);
    await vi.waitFor(() => {
      expect(screen.queryByTestId('password-unlock-input')).not.toBeInTheDocument();
      expect(screen.getByText('Key A')).toBeInTheDocument();
      expect(screen.getByText('Key B')).toBeInTheDocument();
      expect(screen.getAllByText('Browse')).toHaveLength(2);
    });
  });

  it('peek error is shown in the regular form when peekAuthSlotTypes rejects', async () => {
    mocks.peekAuthSlotTypes.mockRejectedValueOnce(new Error('db error'));
    renderWithI18n(() => <PasswordPrompt />);
    // When peek fails, journalPeek stays null → requiresAllAuth is false →
    // regular password form renders and shows the raw error message.
    await vi.waitFor(() => {
      expect(screen.getByText('db error')).toBeInTheDocument();
    });
  });
});
