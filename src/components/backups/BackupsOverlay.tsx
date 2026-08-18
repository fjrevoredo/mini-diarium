import { Dialog } from '@kobalte/core/dialog';
import { X } from 'lucide-solid';
import BackupsPanel from './BackupsPanel';
import { useI18n } from '../../i18n';

interface BackupsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-auth mode — see {@link BackupsPanel}. */
  reduced?: boolean;
}

/**
 * Standalone dialog around {@link BackupsPanel}.
 *
 * Exists for the pre-auth case: inside the app the panel already has a home in Preferences,
 * but the unlock screen has no Preferences to put it in — and the moment the journal will
 * not open is exactly the moment someone needs to see what backups exist.
 */
export default function BackupsOverlay(props: BackupsOverlayProps) {
  const t = useI18n();

  const handleOpenChange = (open: boolean) => {
    if (!open) props.onClose();
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            data-testid="backups-overlay"
            class="relative w-full max-w-2xl rounded-lg bg-primary p-8 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Escape') props.onClose();
            }}
          >
            <Dialog.Title class="text-lg font-semibold text-primary mb-4">
              {t('prefs.backups.title')}
            </Dialog.Title>
            <Dialog.Description class="sr-only">{t('prefs.backups.hint')}</Dialog.Description>

            <div class="overflow-y-auto max-h-[65vh] pr-2">
              <BackupsPanel isVisible={() => props.isOpen} reduced={props.reduced} />
            </div>

            <Dialog.CloseButton class="absolute top-5 right-5 rounded-md p-1 text-tertiary hover:bg-hover hover:text-secondary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors">
              <span class="sr-only">{t('common.close')}</span>
              <X size={20} />
            </Dialog.CloseButton>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
