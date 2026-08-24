import { Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ExternalLink, X } from 'lucide-solid';
import { useI18n } from '../../i18n';
import type { NotificationEntry } from '../../state/notifications';
import { parseMarkdownToHtml } from '../../lib/markdown';
import { typeBadgeLabel } from './NotificationsOverlay';

interface NotificationDetailDialogProps {
  isOpen: boolean;
  entry: NotificationEntry;
  onClose: () => void;
}

export default function NotificationDetailDialog(props: NotificationDetailDialogProps) {
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
            data-testid="notification-detail-dialog"
            class="w-full max-w-xl rounded-lg bg-primary p-8 relative data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
          >
            {/* Header */}
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2 min-w-0">
                <span class="rounded-full bg-tertiary px-2 py-0.5 text-xs font-medium text-secondary shrink-0">
                  {typeBadgeLabel(t, props.entry.type)}
                </span>
                <Dialog.Title class="text-lg font-semibold text-primary truncate">
                  {props.entry.title}
                </Dialog.Title>
              </div>
              <button
                onClick={() => props.onClose()}
                class="rounded-md p-1 hover:bg-hover transition-colors shrink-0"
                aria-label={t('notifications.detailCloseAria')}
              >
                <X size={20} class="text-tertiary" />
              </button>
            </div>

            {/* Body */}
            <div class="overflow-y-auto max-h-[65vh] pr-2 space-y-4">
              <div
                class="text-sm text-secondary [&_a]:text-interactive [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-0.5 [&_p]:mb-1 [&_p:last-child]:mb-0 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-primary [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-primary [&_h3]:mb-1"
                // eslint-disable-next-line solid/no-innerhtml
                innerHTML={parseMarkdownToHtml(props.entry.body!)}
              />
            </div>

            {/* Footer */}
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-primary">
              <Show when={props.entry.linkUrl && props.entry.linkLabel} fallback={<span />}>
                <button
                  onClick={() => openUrl(props.entry.linkUrl!)}
                  class="flex items-center gap-1 text-xs text-interactive hover:underline"
                  data-testid="notification-detail-link"
                >
                  {props.entry.linkLabel}
                  <ExternalLink size={12} />
                </button>
              </Show>
              <button
                onClick={() => props.onClose()}
                class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
                data-testid="notification-detail-close-button"
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
