import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  unlockJournal: vi.fn(),
  unlockWithKeypair: vi.fn(),
  goToJournalPicker: vi.fn(),
  journals: vi.fn(() => [{ id: 'j1', name: 'My Journal', path: '/tmp' }]),
  activeJournalId: vi.fn(() => 'j1'),
}));

vi.mock('../../state/auth', () => ({
  unlockJournal: mocks.unlockJournal,
  unlockWithKeypair: mocks.unlockWithKeypair,
  goToJournalPicker: mocks.goToJournalPicker,
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
  });

  it('renders password input with correct testid and type', () => {
    render(() => <PasswordPrompt />);

    const input = screen.getByTestId('password-unlock-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('password input has bg-primary class (dark theme regression)', () => {
    render(() => <PasswordPrompt />);

    const input = screen.getByTestId('password-unlock-input');
    expect(input.className).toContain('bg-primary');
  });

  it('shows error message when unlockJournal rejects', async () => {
    mocks.unlockJournal.mockRejectedValueOnce(new Error('Invalid password'));

    render(() => <PasswordPrompt />);

    const input = screen.getByTestId('password-unlock-input');
    fireEvent.input(input, { target: { value: 'wrongpassword' } });

    const submitButton = screen.getByTestId('unlock-journal-button');
    fireEvent.click(submitButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Invalid password')).toBeInTheDocument();
    });
  });

  it('displays the active journal name in the subtitle', () => {
    render(() => <PasswordPrompt />);
    expect(screen.getByText('My Journal')).toBeInTheDocument();
  });

  it('renders key-file mode when Key File tab is clicked', () => {
    render(() => <PasswordPrompt />);

    const keyFileTab = screen.getByText('Key File');
    fireEvent.click(keyFileTab);

    expect(screen.getByText('Private Key File')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });
});
