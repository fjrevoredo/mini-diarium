import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { confirm as dialogConfirm } from '@tauri-apps/plugin-dialog';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { AuthMethodsList } from './AuthMethodsList';

const { mockVerifyPassword, mockRemoveAuthMethod } = vi.hoisted(() => ({
  mockVerifyPassword: vi.fn(() => Promise.resolve()),
  mockRemoveAuthMethod: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    verifyPassword: mockVerifyPassword,
    removeAuthMethod: mockRemoveAuthMethod,
  };
});

const { mockAuthMethods, mockLoadAuthMethods } = vi.hoisted(() => ({
  mockAuthMethods: vi.fn(
    () => [] as { id: number; slot_type: string; label: string; last_used: string | null }[],
  ),
  mockLoadAuthMethods: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../state/auth', () => ({
  authMethods: mockAuthMethods,
  loadAuthMethods: mockLoadAuthMethods,
}));

function renderList(onReviewBackups?: () => void) {
  const [isOpen] = createSignal(true);
  return renderWithI18n(() => (
    <AuthMethodsList isOpen={isOpen} onReviewBackups={onReviewBackups} />
  ));
}

describe('AuthMethodsList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides Remove button when only one method exists', () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
    ]);
    renderList();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('shows Remove button when two or more methods exist', () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderList();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('shows error when password is required but not provided before removal', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    renderList();
    // Click remove without filling in password
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[0]);
    await vi.waitFor(() => {
      expect(
        screen.getByText('Current password is required to remove an auth method'),
      ).toBeInTheDocument();
    });
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it('calls verifyPassword before showing the confirm dialog', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);

    const callOrder: string[] = [];
    mockVerifyPassword.mockImplementation(async () => {
      callOrder.push('verifyPassword');
    });
    vi.mocked(dialogConfirm).mockImplementation(async () => {
      callOrder.push('confirm');
      return false;
    });

    renderList();
    fireEvent.input(screen.getByPlaceholderText('Enter current password'), {
      target: { value: 'mypassword' },
    });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[0]);

    await vi.waitFor(() => {
      expect(mockVerifyPassword).toHaveBeenCalled();
      expect(vi.mocked(dialogConfirm)).toHaveBeenCalled();
    });

    expect(callOrder).toEqual(['verifyPassword', 'confirm']);
  });

  it('shows a dismissible post-removal notice after a successful removal', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    vi.mocked(dialogConfirm).mockResolvedValue(true);

    renderList();
    fireEvent.input(screen.getByPlaceholderText('Enter current password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    await vi.waitFor(() => {
      expect(mockRemoveAuthMethod).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('removed-method-notice')).toBeInTheDocument();
    });

    // Dismissible, not auto-timed: it must still be there after a while.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId('removed-method-notice')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('removed-method-notice')).not.toBeInTheDocument();
  });

  it('does not show a "Review backups" action when no callback is supplied', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    vi.mocked(dialogConfirm).mockResolvedValue(true);

    renderList();
    fireEvent.input(screen.getByPlaceholderText('Enter current password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    await vi.waitFor(() => {
      expect(screen.getByTestId('removed-method-notice')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Review backups' })).not.toBeInTheDocument();
  });

  it('calls onReviewBackups and dismisses the notice when "Review backups" is clicked', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
      { id: 2, slot_type: 'keypair', label: 'My Key', last_used: null },
    ]);
    vi.mocked(dialogConfirm).mockResolvedValue(true);
    const onReviewBackups = vi.fn();

    renderList(onReviewBackups);
    fireEvent.input(screen.getByPlaceholderText('Enter current password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    await vi.waitFor(() => {
      expect(screen.getByTestId('removed-method-notice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Review backups' }));

    expect(onReviewBackups).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('removed-method-notice')).not.toBeInTheDocument();
  });
});
