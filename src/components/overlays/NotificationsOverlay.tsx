import { createSignal, For, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Bell, ChevronRight, ExternalLink, X } from 'lucide-solid';
import { useI18n } from '../../i18n';
import {
  allNotifications,
  isRead,
  markAllRead,
  markAsRead,
  type NotificationEntry,
  type NotificationType,
} from '../../state/notifications';
import { isNotificationsOpen, setIsNotificationsOpen } from '../../state/ui';
import { parseMarkdownToHtml } from '../../lib/markdown';
import NotificationDetailDialog from './NotificationDetailDialog';

export function typeBadgeLabel(t: ReturnType<typeof useI18n>, type: NotificationType): string {
  if (type === 'release') return t('notifications.typeRelease');
  if (type === 'announcement') return t('notifications.typeAnnouncement');
  return t('notifications.typeTip');
}

export default function NotificationsOverlay() {
  const t = useI18n();
  const [detailEntry, setDetailEntry] = createSignal<NotificationEntry | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) setIsNotificationsOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    setIsNotificationsOpen(false);
  };

  return (
    <>
      <Dialog open={isNotificationsOpen()} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            class="fixed inset-0 z-50"
            style={{ 'background-color': 'var(--overlay-bg)' }}
          />
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content
              class="w-full max-w-md rounded-lg bg-primary data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
              style={{ 'box-shadow': 'var(--shadow-lg)' }}
            >
              {/* Header */}
              <div class="flex items-center justify-between border-b border-primary px-6 py-4">
                <div class="flex items-center gap-2">
                  <Bell size={18} class="text-tertiary" />
                  <Dialog.Title class="text-lg font-semibold text-primary">
                    {t('notifications.title')}
                  </Dialog.Title>
                </div>
                <Dialog.CloseButton
                  class="rounded-md p-1 hover:bg-hover transition-colors"
                  aria-label={t('notifications.closeAria')}
                >
                  <X size={20} class="text-tertiary" />
                </Dialog.CloseButton>
              </div>

              {/* Feed */}
              <div class="overflow-y-auto max-h-[60vh]">
                <Show
                  when={allNotifications().length > 0}
                  fallback={
                    <p class="py-12 text-center text-sm text-secondary">
                      {t('notifications.empty')}
                    </p>
                  }
                >
                  <For each={allNotifications()}>
                    {(entry) => {
                      const read = () => isRead(entry.id);
                      return (
                        <div
                          class="flex gap-3 border-b border-primary px-6 py-4 last:border-b-0"
                          classList={{
                            'bg-secondary': !read(),
                            'bg-primary': read(),
                          }}
                        >
                          {/* Unread dot */}
                          <div class="mt-1.5 shrink-0 w-2 h-2">
                            <Show when={!read()}>
                              <span
                                class="block h-2 w-2 rounded-full bg-interactive"
                                aria-hidden="true"
                                data-testid={`unread-dot-${entry.id}`}
                              />
                            </Show>
                          </div>

                          {/* Content */}
                          <div class="flex-1 min-w-0">
                            {/* Type badge + title */}
                            <div class="flex items-center gap-2 mb-1">
                              <span class="rounded-full bg-tertiary px-2 py-0.5 text-xs font-medium text-secondary">
                                {typeBadgeLabel(t, entry.type)}
                              </span>
                              <p class="text-sm font-semibold text-primary truncate">
                                {entry.title}
                              </p>
                            </div>

                            {/* Summary */}
                            <div
                              class="text-sm text-secondary mb-2 line-clamp-3 [&_a]:text-interactive [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-0.5 [&_p]:mb-1 [&_p:last-child]:mb-0"
                              // eslint-disable-next-line solid/no-innerhtml
                              innerHTML={parseMarkdownToHtml(entry.summary)}
                            />

                            {/* Footer row */}
                            <div class="flex items-center gap-3 flex-wrap">
                              <span class="text-xs text-tertiary">{entry.date}</span>
                              <Show when={entry.linkUrl && entry.linkLabel}>
                                <button
                                  onClick={() => openUrl(entry.linkUrl!)}
                                  class="flex items-center gap-1 text-xs text-interactive hover:underline"
                                  data-testid={`link-${entry.id}`}
                                >
                                  {entry.linkLabel}
                                  <ExternalLink size={12} />
                                </button>
                              </Show>
                              <Show when={entry.body}>
                                <button
                                  onClick={() => setDetailEntry(entry)}
                                  class="flex items-center gap-1 rounded-full interactive-primary px-2.5 py-1 text-xs font-medium leading-none transition-colors"
                                  aria-label={t('notifications.readMoreAria', {
                                    title: entry.title,
                                  })}
                                  data-testid={`read-more-${entry.id}`}
                                >
                                  {t('notifications.readMore')}
                                  <ChevronRight size={12} />
                                </button>
                              </Show>
                              <Show when={!read()}>
                                <button
                                  onClick={() => markAsRead(entry.id)}
                                  class="ml-auto text-xs text-tertiary hover:text-primary transition-colors"
                                  aria-label={t('notifications.markReadAria')}
                                  data-testid={`mark-read-${entry.id}`}
                                >
                                  {t('notifications.markRead')}
                                </button>
                              </Show>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>

              {/* Footer */}
              <div class="flex items-center justify-between border-t border-primary px-6 py-4">
                <button
                  onClick={handleMarkAllRead}
                  class="text-sm text-tertiary hover:text-primary transition-colors"
                  data-testid="mark-all-read-button"
                >
                  {t('notifications.dismissAll')}
                </button>
                <button
                  onClick={() => setIsNotificationsOpen(false)}
                  class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
                  data-testid="notifications-close-button"
                >
                  {t('common.close')}
                </button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
      <Show when={detailEntry()}>
        {(entry) => (
          <NotificationDetailDialog isOpen entry={entry()} onClose={() => setDetailEntry(null)} />
        )}
      </Show>
    </>
  );
}
