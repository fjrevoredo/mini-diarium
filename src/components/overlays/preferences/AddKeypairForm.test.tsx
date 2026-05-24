import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { save } from '@tauri-apps/plugin-dialog';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { AddKeypairForm } from './AddKeypairForm';

const { mockVerifyPassword, mockGenerateKeypair, mockRegisterKeypair, mockWriteKeyFile } =
  vi.hoisted(() => ({
    mockVerifyPassword: vi.fn(() => Promise.resolve()),
    mockGenerateKeypair: vi.fn(() =>
      Promise.resolve({ public_key_hex: 'aabbcc', private_key_hex: 'ddeeff' }),
    ),
    mockRegisterKeypair: vi.fn(() => Promise.resolve()),
    mockWriteKeyFile: vi.fn(() => Promise.resolve()),
  }));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    verifyPassword: mockVerifyPassword,
    generateKeypair: mockGenerateKeypair,
    registerKeypair: mockRegisterKeypair,
    writeKeyFile: mockWriteKeyFile,
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

function renderForm() {
  const [isOpen] = createSignal(true);
  return renderWithI18n(() => <AddKeypairForm isOpen={isOpen} />);
}

function getButton() {
  return screen.getByRole('button', { name: 'Generate & Register Key File' });
}

describe('AddKeypairForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockAuthMethods.mockReturnValue([]);
  });

  it('shows error when label is empty', async () => {
    renderForm();
    fireEvent.click(getButton());
    await vi.waitFor(() => {
      expect(screen.getByText('Label is required')).toBeInTheDocument();
    });
    expect(mockGenerateKeypair).not.toHaveBeenCalled();
  });

  it('shows error when password is required but not provided', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
    ]);
    renderForm();
    // Fill in label but leave password blank
    fireEvent.input(screen.getByPlaceholderText('e.g. My YubiKey'), {
      target: { value: 'My Key' },
    });
    fireEvent.click(getButton());
    await vi.waitFor(() => {
      expect(screen.getByText('Current password is required')).toBeInTheDocument();
    });
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it('shows cancelled message when save dialog returns null', async () => {
    vi.mocked(save).mockResolvedValueOnce(null);
    renderForm();
    fireEvent.input(screen.getByPlaceholderText('e.g. My YubiKey'), {
      target: { value: 'My Key' },
    });
    fireEvent.click(getButton());
    await vi.waitFor(() => {
      expect(screen.getByText('Key file save cancelled')).toBeInTheDocument();
    });
    expect(mockRegisterKeypair).not.toHaveBeenCalled();
    expect(mockWriteKeyFile).not.toHaveBeenCalled();
  });

  it('does not write key file to disk when registerKeypair fails', async () => {
    vi.mocked(save).mockResolvedValueOnce('/tmp/test.key');
    mockRegisterKeypair.mockRejectedValueOnce(new Error('DB write failed'));
    renderForm();
    fireEvent.input(screen.getByPlaceholderText('e.g. My YubiKey'), {
      target: { value: 'My Key' },
    });
    fireEvent.click(getButton());
    // Wait for the error to appear (confirming the async flow completed)
    await vi.waitFor(() => {
      expect(document.querySelector('.text-error')).toBeInTheDocument();
    });
    expect(mockWriteKeyFile).not.toHaveBeenCalled();
  });

  it('calls operations in security order: verifyPassword → generateKeypair → save → registerKeypair → writeKeyFile', async () => {
    mockAuthMethods.mockReturnValue([
      { id: 1, slot_type: 'password', label: 'Password', last_used: null },
    ]);

    const callOrder: string[] = [];
    mockVerifyPassword.mockImplementation(async () => {
      callOrder.push('verifyPassword');
    });
    mockGenerateKeypair.mockImplementation(async () => {
      callOrder.push('generateKeypair');
      return { public_key_hex: 'aabbcc', private_key_hex: 'ddeeff' };
    });
    vi.mocked(save).mockImplementation(async () => {
      callOrder.push('save');
      return '/tmp/test.key';
    });
    mockRegisterKeypair.mockImplementation(async () => {
      callOrder.push('registerKeypair');
    });
    mockWriteKeyFile.mockImplementation(async () => {
      callOrder.push('writeKeyFile');
    });

    renderForm();
    fireEvent.input(screen.getByPlaceholderText('e.g. My YubiKey'), {
      target: { value: 'My Key' },
    });
    fireEvent.input(screen.getByPlaceholderText('Verify identity'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(getButton());

    await vi.waitFor(() => {
      expect(mockWriteKeyFile).toHaveBeenCalled();
    });

    expect(callOrder).toEqual([
      'verifyPassword',
      'generateKeypair',
      'save',
      'registerKeypair',
      'writeKeyFile',
    ]);
  });
});
