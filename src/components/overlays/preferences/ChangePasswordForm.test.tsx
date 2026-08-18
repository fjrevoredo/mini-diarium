import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { ChangePasswordForm } from './ChangePasswordForm';

const { mockChangePassword } = vi.hoisted(() => ({
  mockChangePassword: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    changePassword: mockChangePassword,
  };
});

function renderForm() {
  const [isOpen] = createSignal(true);
  return renderWithI18n(() => <ChangePasswordForm isOpen={isOpen} />);
}

function fillField(placeholder: string, value: string) {
  fireEvent.input(screen.getByPlaceholderText(placeholder), { target: { value } });
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChangePassword.mockResolvedValue(undefined);
  });

  it('shows the persistent snapshot-credential warning unconditionally', () => {
    renderForm();
    expect(
      screen.getByText(
        'Backups taken before this change will still require your current (old) password to open. Keep it somewhere safe, or take a fresh backup right after changing your password.',
      ),
    ).toBeInTheDocument();
  });

  it('shows error when any field is empty', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await vi.waitFor(() => {
      expect(screen.getByText('All fields are required')).toBeInTheDocument();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('shows mismatch error when new and confirm passwords differ', async () => {
    renderForm();
    fillField('Enter current password', 'oldpass');
    fillField('Enter new password', 'newpass1');
    fillField('Confirm new password', 'newpass2');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await vi.waitFor(() => {
      expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('calls changePassword with correct args, shows success, and clears fields', async () => {
    renderForm();
    fillField('Enter current password', 'oldpass');
    fillField('Enter new password', 'newpass');
    fillField('Confirm new password', 'newpass');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await vi.waitFor(() => {
      expect(screen.getByText('Password changed successfully!')).toBeInTheDocument();
    });
    expect(mockChangePassword).toHaveBeenCalledWith('oldpass', 'newpass');

    const oldInput = screen.getByPlaceholderText('Enter current password') as HTMLInputElement;
    const newInput = screen.getByPlaceholderText('Enter new password') as HTMLInputElement;
    const confirmInput = screen.getByPlaceholderText('Confirm new password') as HTMLInputElement;
    expect(oldInput.value).toBe('');
    expect(newInput.value).toBe('');
    expect(confirmInput.value).toBe('');
  });

  it('shows error banner when changePassword rejects', async () => {
    // "wrong password" is sanitised by mapTauriError to the i18n key errors.incorrectPassword.
    mockChangePassword.mockRejectedValueOnce(new Error('wrong password'));
    renderForm();
    fillField('Enter current password', 'wrongpass');
    fillField('Enter new password', 'newpass');
    fillField('Confirm new password', 'newpass');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await vi.waitFor(() => {
      expect(screen.getByText('Incorrect password.')).toBeInTheDocument();
    });
    expect(mockChangePassword).toHaveBeenCalledOnce();
  });
});
