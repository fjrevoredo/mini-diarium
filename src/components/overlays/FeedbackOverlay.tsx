import { createSignal, createEffect, For, type JSX } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { getVersion } from '@tauri-apps/api/app';
import { useI18n } from '../../i18n';
import { X, Bug, Lightbulb, Mail } from 'lucide-solid';
import { openUrlSuppressingFocusLoss } from '../../lib/dialog';
import { BUG_REPORT_URL, FEATURE_REQUEST_URL, buildFeedbackMailto } from '../../lib/feedback-links';

interface FeedbackOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FeedbackOption {
  testId: string;
  icon: () => JSX.Element;
  label: string;
  hint: string;
  url: () => string;
}

export default function FeedbackOverlay(props: FeedbackOverlayProps) {
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

  const options = (): FeedbackOption[] => [
    {
      testId: 'feedback-bug',
      icon: () => <Bug size={18} />,
      label: t('feedback.reportBug'),
      hint: t('feedback.reportBugHint'),
      url: () => BUG_REPORT_URL,
    },
    {
      testId: 'feedback-feature',
      icon: () => <Lightbulb size={18} />,
      label: t('feedback.suggestFeature'),
      hint: t('feedback.suggestFeatureHint'),
      url: () => FEATURE_REQUEST_URL,
    },
    {
      testId: 'feedback-email',
      icon: () => <Mail size={18} />,
      label: t('feedback.emailDeveloper'),
      hint: t('feedback.emailDeveloperHint'),
      url: () => buildFeedbackMailto(version()),
    },
  ];

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            data-testid="feedback-overlay"
            class="w-full max-w-sm max-h-full overflow-y-auto rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
          >
            {/* Title row */}
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-primary">
                {t('feedback.title')}
              </Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label={t('feedback.closeAria')}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-sm text-secondary mb-4">
              {t('feedback.intro')}
            </Dialog.Description>

            {/* One row per channel: label plus where it takes the user */}
            <div class="flex flex-col gap-2 mb-4">
              <For each={options()}>
                {(option) => (
                  <button
                    data-testid={option.testId}
                    onClick={() => openUrlSuppressingFocusLoss(option.url())}
                    class="flex items-start gap-3 rounded-lg border border-primary px-4 py-3 text-left text-secondary hover:bg-hover hover:text-primary transition-colors"
                  >
                    <span class="mt-0.5 shrink-0">{option.icon()}</span>
                    <span class="flex flex-col">
                      <span class="text-sm font-medium text-primary">{option.label}</span>
                      <span class="text-xs text-tertiary">{option.hint}</span>
                    </span>
                  </button>
                )}
              </For>
            </div>

            <p class="text-xs text-tertiary mb-6">{t('feedback.privacyNote')}</p>

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
