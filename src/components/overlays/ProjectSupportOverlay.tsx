import { createSignal, createEffect, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Dialog } from '@kobalte/core/dialog';
import { HandCoins, HandHelping, MailPlus, Share2, Star, Store, X } from 'lucide-solid';
import { useI18n, type T } from '../../i18n';
import { getStatistics, type Statistics } from '../../lib/tauri/statistics';
import { openUrlSuppressingFocusLoss } from '../../lib/dialog';
import { isProjectSupportOpen, setIsProjectSupportOpen, projectSupportEntry } from '../../state/ui';
import { dismissSupportMilestone } from '../../state/support-milestone';
import {
  isChecklistItemDone,
  toggleChecklistItem,
  checklistDoneCount,
  type SupportChecklistItem,
} from '../../state/project-support';

const GITHUB_URL = 'https://github.com/fjrevoredo/mini-diarium';
const STORE_URL = 'https://apps.microsoft.com/detail/9PJFTX44ZS43';
const NEWSLETTER_URL = 'https://mini-diarium.com/newsletter/';
const DONATE_URL = 'https://mini-diarium.com/donate/';

type TranslationKey = Parameters<T>[0];

interface ChecklistRow {
  item: SupportChecklistItem;
  labelKey: TranslationKey;
  buttonKey: TranslationKey;
  icon: typeof Star;
}

const CHECKLIST_ROWS: ChecklistRow[] = [
  {
    item: 'star',
    labelKey: 'support.itemStarLabel',
    buttonKey: 'support.itemStarButton',
    icon: Star,
  },
  {
    item: 'review',
    labelKey: 'support.itemReviewLabel',
    buttonKey: 'support.itemReviewButton',
    icon: Store,
  },
  {
    item: 'share',
    labelKey: 'support.itemShareLabel',
    buttonKey: 'support.itemShareButton',
    icon: Share2,
  },
  {
    item: 'newsletter',
    labelKey: 'support.itemNewsletterLabel',
    buttonKey: 'support.itemNewsletterButton',
    icon: MailPlus,
  },
  {
    item: 'contribute',
    labelKey: 'support.itemContributeLabel',
    buttonKey: 'support.itemContributeButton',
    icon: HandHelping,
  },
  {
    item: 'donate',
    labelKey: 'support.itemDonateLabel',
    buttonKey: 'support.itemDonateButton',
    icon: HandCoins,
  },
];

export default function ProjectSupportOverlay() {
  const t = useI18n();
  const [stats, setStats] = createSignal<Statistics | null>(null);
  const [shareCopyState, setShareCopyState] = createSignal<'idle' | 'copied' | 'failed'>('idle');

  createEffect(() => {
    if (isProjectSupportOpen() && projectSupportEntry() === 'milestone') {
      getStatistics()
        .then(setStats)
        .catch(() => setStats(null));
    }
  });

  const handleClose = () => {
    setIsProjectSupportOpen(false);
    setShareCopyState('idle');
    if (projectSupportEntry() === 'milestone') {
      dismissSupportMilestone();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  const openingLine = () => {
    if (projectSupportEntry() === 'milestone') {
      const s = stats();
      return t('support.openingLineMilestone', {
        streak: s?.best_streak ?? 0,
        words: s?.total_words ?? 0,
      });
    }
    return t('support.openingLineAbout');
  };

  const handleAction = (item: SupportChecklistItem) => {
    const url =
      item === 'star'
        ? GITHUB_URL
        : item === 'review'
          ? STORE_URL
          : item === 'newsletter'
            ? NEWSLETTER_URL
            : item === 'contribute'
              ? GITHUB_URL
              : DONATE_URL;
    openUrlSuppressingFocusLoss(url);
    if (!isChecklistItemDone(item)) toggleChecklistItem(item);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(t('support.shareMessage'));
      setShareCopyState('copied');
      if (!isChecklistItemDone('share')) toggleChecklistItem('share');
    } catch {
      setShareCopyState('failed');
    }
  };

  return (
    <Dialog open={isProjectSupportOpen()} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            data-testid="project-support-overlay"
            class="w-full max-w-md rounded-lg bg-primary data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
          >
            <div class="flex items-center justify-between border-b border-primary px-6 py-4">
              <Dialog.Title class="text-lg font-semibold text-primary">
                {t('support.title')}
              </Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label={t('support.closeAria')}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <div class="px-6 py-4">
              <p class="text-sm text-secondary mb-4">{openingLine()}</p>

              <ul class="space-y-2">
                <For each={CHECKLIST_ROWS}>
                  {(row) => (
                    <li class="flex items-center justify-between gap-3">
                      <span class="flex items-center gap-2 text-sm text-primary">
                        <span aria-hidden="true">{isChecklistItemDone(row.item) ? '✓' : '☐'}</span>
                        {t(row.labelKey)}
                      </span>
                      <Show
                        when={row.item === 'share'}
                        fallback={
                          <button
                            onClick={() => handleAction(row.item)}
                            data-testid={`support-item-${row.item}`}
                            class="flex items-center gap-1.5 rounded-full border border-primary px-3 py-1 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors"
                          >
                            <Dynamic
                              component={row.icon}
                              size={14}
                              class="text-interactive shrink-0"
                              aria-hidden="true"
                            />
                            {t(row.buttonKey)}
                          </button>
                        }
                      >
                        <button
                          onClick={() => void handleShare()}
                          data-testid="support-item-share"
                          class="flex items-center gap-1.5 rounded-full border border-primary px-3 py-1 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors"
                        >
                          <Dynamic
                            component={row.icon}
                            size={14}
                            class="text-interactive shrink-0"
                            aria-hidden="true"
                          />
                          {t('support.itemShareButton')}
                        </button>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>

              <Show when={shareCopyState() === 'failed'}>
                <p class="mt-3 text-xs text-secondary">
                  {t('support.shareCopyFailed', { message: t('support.shareMessage') })}
                </p>
              </Show>
            </div>

            <div class="flex items-center justify-between border-t border-primary px-6 py-4">
              <p class="text-xs text-tertiary">
                {checklistDoneCount() === 0
                  ? t('support.footerDefault')
                  : t('support.footerThanked')}
              </p>
              <button
                onClick={() => handleClose()}
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
