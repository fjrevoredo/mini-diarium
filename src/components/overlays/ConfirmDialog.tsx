import { Dialog } from '@kobalte/core/dialog';
import {
  isConfirmDialogOpen,
  confirmDialogMessage,
  confirmDialogTitle,
  respondToConfirm,
} from '../../state/confirm-dialog';
import { useI18n } from '../../i18n';

/**
 * In-app confirm dialog (TODO-0104). Dismissable **only** via the Cancel/Confirm
 * buttons — Escape, backdrop click, and a close icon are all deliberately inert. See the
 * entry-persistence-consent-gate-plan.md Task 2.2 for the verified Kobalte source behavior
 * this depends on: `modal` defaults to `true` (blocks focus-outside dismissal already),
 * and `onEscapeKeyDown`/`onPointerDownOutside` must each call `preventDefault()` with no
 * further action to suppress the two dismiss paths modal alone does not block.
 */
export default function ConfirmDialog() {
  const t = useI18n();
  return (
    <Dialog open={isConfirmDialogOpen()} onOpenChange={() => {}}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content
            class="w-full max-w-md rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            data-testid="confirm-dialog"
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <Dialog.Title class="text-lg font-semibold text-primary mb-4">
              {confirmDialogTitle()}
            </Dialog.Title>

            <Dialog.Description class="text-sm text-secondary mb-6">
              {confirmDialogMessage()}
            </Dialog.Description>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                data-testid="confirm-dialog-cancel-button"
                onClick={() => respondToConfirm(false)}
                class="px-4 py-2 text-sm font-medium text-secondary bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="confirm-dialog-confirm-button"
                onClick={() => respondToConfirm(true)}
                class="px-4 py-2 text-sm font-medium interactive-destructive rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {t('editor.deleteEntry')}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
