import { createSignal, createEffect, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { X } from 'lucide-solid';

interface AboutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutOverlay(props: AboutOverlayProps) {
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
              <Dialog.Title class="text-lg font-semibold text-primary">About</Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label="Close"
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            {/* Logo + name + version */}
            <div class="flex flex-col items-center gap-3 mb-6">
              <img src="/logo-transparent.svg" alt="Mini Diarium" class="h-16 w-16 rounded-xl" />
              <div class="text-center">
                <p class="text-xl font-bold text-primary">Mini Diarium</p>
                <Show when={version()}>
                  <p class="text-sm text-secondary">Version {version()}</p>
                </Show>
              </div>
            </div>

            {/* Description */}
            <p class="text-sm text-secondary text-center mb-6">
              An encrypted, local-first desktop journaling app.
            </p>

            {/* Meta */}
            <div class="space-y-1 text-sm text-secondary border-t border-primary pt-4 mb-4">
              <p>MIT License</p>
              <p>Copyright &copy; 2026 Francisco J. Revoredo</p>
            </div>

            {/* GitHub link */}
            <div class="flex justify-center mb-6">
              <button
                onClick={() => openUrl('https://github.com/fjrevoredo/mini-diarium')}
                class="text-sm text-blue-500 hover:underline"
              >
                github.com/fjrevoredo/mini-diarium
              </button>
            </div>

            {/* Close */}
            <div class="flex justify-end">
              <button
                onClick={() => props.onClose()}
                class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
