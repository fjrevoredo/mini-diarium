import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { confirmInApp, resetConfirmDialogState } from '../../state/confirm-dialog';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  afterEach(() => {
    resetConfirmDialogState();
  });

  it('renders the message/title passed via confirmInApp when open', async () => {
    renderWithI18n(() => <ConfirmDialog />);
    void confirmInApp('Erase this content?', { title: 'Delete Entry' });
    expect(await screen.findByText('Delete Entry')).toBeInTheDocument();
    expect(screen.getByText('Erase this content?')).toBeInTheDocument();
  });

  it('clicking Confirm calls respondToConfirm(true) and closes', async () => {
    renderWithI18n(() => <ConfirmDialog />);
    const promise = confirmInApp('Erase this content?', { title: 'Delete Entry' });
    const confirmButton = await screen.findByTestId('confirm-dialog-confirm-button');
    fireEvent.click(confirmButton);
    await expect(promise).resolves.toBe(true);
  });

  it('clicking Cancel calls respondToConfirm(false) and closes', async () => {
    renderWithI18n(() => <ConfirmDialog />);
    const promise = confirmInApp('Erase this content?', { title: 'Delete Entry' });
    const cancelButton = await screen.findByTestId('confirm-dialog-cancel-button');
    fireEvent.click(cancelButton);
    await expect(promise).resolves.toBe(false);
  });

  it('pressing Escape while open does not close the dialog and does not call respondToConfirm', async () => {
    renderWithI18n(() => <ConfirmDialog />);
    const resolveSpy = vi.fn();
    confirmInApp('Erase this content?', { title: 'Delete Entry' }).then(resolveSpy);
    const dialog = await screen.findByTestId('confirm-dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    // Flush microtasks so a wrongly-fired resolve would have landed by now.
    await Promise.resolve();
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('a simulated outside pointerdown does not close the dialog and does not call respondToConfirm', async () => {
    renderWithI18n(() => <ConfirmDialog />);
    const resolveSpy = vi.fn();
    confirmInApp('Erase this content?', { title: 'Delete Entry' }).then(resolveSpy);
    await screen.findByTestId('confirm-dialog');

    fireEvent.pointerDown(document.body);

    await Promise.resolve();
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('renders no Dialog.CloseButton / × element', async () => {
    renderWithI18n(() => <ConfirmDialog />);
    void confirmInApp('Erase this content?', { title: 'Delete Entry' });
    await screen.findByTestId('confirm-dialog');
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });
});
