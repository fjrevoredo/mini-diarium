import { createSignal, createEffect, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from '../../i18n';
import { X } from 'lucide-solid';

interface AboutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutOverlay(props: AboutOverlayProps) {
  const t = useI18n();
  const [version, setVersion] = createSignal('');

  createEffect(() => {
    if (props.isOpen) {
      getVersion()
        .then(setVersion)
        .catch(() => setVersion(''));
    }
  });

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
            class="w-full max-w-sm rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
          >
            {/* Title row */}
            <div class="flex items-center justify-between mb-6">
              <Dialog.Title class="text-lg font-semibold text-primary">
                {t('about.title')}
              </Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label={t('about.closeAria')}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            {/* Logo + name + version */}
            <div class="flex flex-col items-center gap-3 mb-6">
              <img src="/logo-transparent.svg" alt="Mini Diarium" class="h-16 w-16 rounded-xl" />
              <div class="text-center">
                <p class="text-xl font-bold text-primary">{t('about.appName')}</p>
                <Show when={version()}>
                  <p class="text-sm text-secondary">{t('about.version', { version: version() })}</p>
                </Show>
              </div>
            </div>

            {/* Description */}
            <p class="text-sm text-secondary text-center mb-6">{t('about.description')}</p>

            {/* Meta */}
            <div class="space-y-1 text-sm text-secondary border-t border-primary pt-4 mb-4">
              <p>{t('about.license')}</p>
              <p>{t('about.copyright')}</p>
            </div>

            {/* GitHub + Documentation links */}
            <div class="flex justify-center gap-4 mb-6">
              <button
                onClick={() => openUrl('https://github.com/fjrevoredo/mini-diarium')}
                class="text-sm text-interactive hover:underline"
              >
                {t('about.githubLink')}
              </button>
              <button
                onClick={() => openUrl('https://mini-diarium.com/docs/')}
                class="text-sm text-interactive hover:underline"
              >
                {t('about.docsLink')}
              </button>
            </div>

            {/* Close */}
            <div class="flex justify-end">
              <button
                onClick={() => props.onClose()}
                class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
