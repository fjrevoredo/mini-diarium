import { createSignal } from 'solid-js';
import BackupsOverlay from '../backups/BackupsOverlay';
import { useI18n } from '../../i18n';

/**
 * The row of things a user can reach *without* unlocking a journal.
 *
 * Deliberately its own component rather than inline markup on the unlock screen: the
 * pre-auth surface is the recovery surface, and it is going to grow. TODO-0094 needs the
 * locked-journal debug dump here next; adding it means adding one button to this row, not
 * re-deriving how a pre-auth affordance should look.
 *
 * Everything reachable from here must work against a journal that cannot be opened, and
 * must expose nothing that a key would be required to read.
 */
export default function PreAuthTools() {
  const t = useI18n();
  const [isBackupsOpen, setIsBackupsOpen] = createSignal(false);

  return (
    <>
      <div
        class="mt-6 flex justify-center gap-4 border-t border-primary pt-4"
        role="group"
        aria-label={t('auth.prompt.toolsAria')}
        data-testid="pre-auth-tools"
      >
        <button
          type="button"
          onClick={() => setIsBackupsOpen(true)}
          data-testid="pre-auth-backups-button"
          class="text-sm text-tertiary hover:text-secondary underline focus:outline-none"
        >
          {t('auth.prompt.viewBackups')}
        </button>
      </div>

      <BackupsOverlay isOpen={isBackupsOpen()} onClose={() => setIsBackupsOpen(false)} reduced />
    </>
  );
}
