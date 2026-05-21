import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  createJournal: vi.fn(),
  createJournalAutoProtected: vi.fn(),
  goToJournalPicker: vi.fn(),
}));

vi.mock('../../state/auth', () => ({
  createJournal: mocks.createJournal,
  createJournalAutoProtected: mocks.createJournalAutoProtected,
  goToJournalPicker: mocks.goToJournalPicker,
}));

// ──────────────────────────────────────────────────────────────────────────────

import PasswordCreation from './PasswordCreation';

describe('PasswordCreation component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createJournal.mockResolvedValue(undefined);
    mocks.createJournalAutoProtected.mockResolvedValue(undefined);
  });

  it('renders both password inputs with correct data-testid attributes', () => {
    renderWithI18n(() => <PasswordCreation />);

    expect(screen.getByTestId('password-create-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-repeat-input')).toBeInTheDocument();
  });

  it('both password inputs have bg-primary class (dark theme regression)', () => {
    renderWithI18n(() => <PasswordCreation />);

    const createInput = screen.getByTestId('password-create-input');
    const repeatInput = screen.getByTestId('password-repeat-input');

    expect(createInput.className).toContain('bg-primary');
    expect(repeatInput.className).toContain('bg-primary');
  });

  it('sanitizes raw Tauri error — does not display rusqlite internals to user', async () => {
    mocks.createJournal.mockRejectedValue(new Error('rusqlite: disk I/O error'));

    renderWithI18n(() => <PasswordCreation />);

    const createInput = screen.getByTestId('password-create-input');
    const repeatInput = screen.getByTestId('password-repeat-input');
    const submit = screen.getByTestId('create-journal-button');

    fireEvent.input(createInput, { target: { value: 'testpassword' } });
    fireEvent.input(repeatInput, { target: { value: 'testpassword' } });
    fireEvent.click(submit);

    await vi.waitFor(() => {
      expect(screen.queryByText(/rusqlite/i)).not.toBeInTheDocument();
      expect(screen.getByText('An internal error occurred.')).toBeInTheDocument();
    });
  });

  it('shows "Passwords do not match" error when passwords differ before submit', async () => {
    renderWithI18n(() => <PasswordCreation />);

    const createInput = screen.getByTestId('password-create-input');
    const repeatInput = screen.getByTestId('password-repeat-input');
    const submitButton = screen.getByTestId('create-journal-button');

    fireEvent.input(createInput, { target: { value: 'password123' } });
    fireEvent.input(repeatInput, { target: { value: 'different456' } });
    fireEvent.click(submitButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    expect(mocks.createJournal).not.toHaveBeenCalled();
  });
});
