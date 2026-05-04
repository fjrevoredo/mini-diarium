import { createSignal } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import type { Editor } from '@tiptap/core';
import { useI18n } from '../../i18n';
import { preferences, setPreferences } from '../../state/preferences';

interface TimestampOverlayProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatTimestamp = (format: '12h' | '24h', precision: 'hm' | 'hms'): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: precision === 'hms' ? '2-digit' : undefined,
    hour12: format === '12h',
  };
  return now.toLocaleTimeString('en-US', options);
};

export default function TimestampOverlay(props: TimestampOverlayProps) {
  const t = useI18n();
  const [format, setFormat] = createSignal<'12h' | '24h'>(preferences().timestampFormat);
  const [precision, setPrecision] = createSignal<'hm' | 'hms'>(preferences().timestampPrecision);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  const handleConfirm = () => {
    if (!props.editor) return;
    const formatted = formatTimestamp(format(), precision());
    props.editor.chain().focus().insertContent(`<span class="timestamp">${formatted}</span>`).run();
    props.onClose();
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content
            class="w-full max-w-sm rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title class="text-lg font-semibold text-primary mb-4">
              {t('timestamp.popupTitle')}
            </Dialog.Title>

            <div class="space-y-4">
              <div>
                <label
                  for="timestamp-format-select"
                  class="block text-sm font-medium text-secondary mb-2"
                >
                  {t('timestamp.formatLabel')}
                </label>
                <select
                  id="timestamp-format-select"
                  value={format()}
                  onChange={(e) => {
                    const val = e.currentTarget.value as '12h' | '24h';
                    setFormat(val);
                    setPreferences({ timestampFormat: val });
                  }}
                  class="w-full h-8 rounded border border-primary bg-primary px-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  data-testid="timestamp-format-select"
                >
                  <option value="12h">{t('timestamp.format12h')}</option>
                  <option value="24h">{t('timestamp.format24h')}</option>
                </select>
              </div>

              <div>
                <label
                  for="timestamp-precision-select"
                  class="block text-sm font-medium text-secondary mb-2"
                >
                  {t('timestamp.precisionLabel')}
                </label>
                <select
                  id="timestamp-precision-select"
                  value={precision()}
                  onChange={(e) => {
                    const val = e.currentTarget.value as 'hm' | 'hms';
                    setPrecision(val);
                    setPreferences({ timestampPrecision: val });
                  }}
                  class="w-full h-8 rounded border border-primary bg-primary px-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  data-testid="timestamp-precision-select"
                >
                  <option value="hm">{t('timestamp.precisionHm')}</option>
                  <option value="hms">{t('timestamp.precisionHms')}</option>
                </select>
              </div>

              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => props.onClose()}
                  class="px-4 py-2 text-sm font-medium text-secondary bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!props.editor}
                  class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="timestamp-insert-button"
                >
                  {t('timestamp.insert')}
                </button>
              </div>
            </div>

            <Dialog.CloseButton class="absolute top-4 right-4 inline-flex items-center justify-center rounded-md p-1 text-tertiary hover:text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
              <span class="sr-only">{t('common.close')}</span>
              <svg
                class="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Dialog.CloseButton>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
