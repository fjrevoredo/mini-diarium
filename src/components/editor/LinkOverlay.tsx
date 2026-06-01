import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import type { Editor } from '@tiptap/core';
import { useI18n } from '../../i18n';

interface LinkOverlayProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

type LinkMode = 'edit' | 'wrap-selection' | 'insert';

const ALLOWED_SCHEMES = ['http://', 'https://', 'mailto:', 'tel:'];

const isAllowedUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return ALLOWED_SCHEMES.some((scheme) => lower.startsWith(scheme));
};

export default function LinkOverlay(props: LinkOverlayProps) {
  const t = useI18n();
  const [urlInput, setUrlInput] = createSignal('');
  const [touched, setTouched] = createSignal(false);

  const mode = createMemo<LinkMode>(() => {
    const editor = props.editor;
    if (!editor) return 'insert';
    if (editor.isActive('link')) return 'edit';
    // Defensive: editor.state may be undefined in mocked tests
    const selection = editor.state?.selection;
    if (selection && selection.from !== selection.to) return 'wrap-selection';
    return 'insert';
  });

  // Reset URL input from the editor whenever the dialog opens.
  createEffect(() => {
    if (!props.isOpen) return;
    const editor = props.editor;
    setTouched(false);
    if (editor && editor.isActive('link')) {
      const href = (editor.getAttributes('link').href as string | undefined) ?? '';
      setUrlInput(href);
    } else {
      setUrlInput('');
    }
  });

  const trimmedUrl = () => urlInput().trim();
  const urlIsValid = () => isAllowedUrl(urlInput());

  const titleText = () => {
    switch (mode()) {
      case 'edit':
        return t('link.editTitle');
      case 'wrap-selection':
        return t('link.wrapSelectionTitle');
      case 'insert':
      default:
        return t('link.insertTitle');
    }
  };

  const confirmLabel = () => {
    switch (mode()) {
      case 'edit':
        return t('link.update');
      case 'wrap-selection':
        return t('link.apply');
      case 'insert':
      default:
        return t('link.insert');
    }
  };

  const handleConfirm = () => {
    const editor = props.editor;
    if (!editor) return;
    setTouched(true);
    if (!urlIsValid()) return;

    const href = trimmedUrl();
    const currentMode = mode();
    if (currentMode === 'insert') {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: href,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    props.onClose();
  };

  const handleRemove = () => {
    const editor = props.editor;
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    props.onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    } else if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleConfirm();
    }
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
              {titleText()}
            </Dialog.Title>

            <div class="space-y-4">
              <div>
                <label for="link-url-input" class="block text-sm font-medium text-secondary mb-2">
                  {t('link.urlLabel')}
                </label>
                <input
                  id="link-url-input"
                  type="url"
                  value={urlInput()}
                  onInput={(e) => setUrlInput(e.currentTarget.value)}
                  placeholder={t('link.urlPlaceholder')}
                  class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autofocus
                  data-testid="link-url-input"
                  aria-invalid={touched() && !urlIsValid()}
                />
                <Show when={touched() && !urlIsValid()}>
                  <p class="mt-2 text-xs text-error" role="alert">
                    {t('link.invalidUrlError')}
                  </p>
                </Show>
              </div>

              <div class="flex justify-end gap-3">
                <Show when={mode() === 'edit'}>
                  <button
                    type="button"
                    onClick={handleRemove}
                    class="mr-auto px-4 py-2 text-sm font-medium text-destructive bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    data-testid="link-remove-button"
                  >
                    {t('link.remove')}
                  </button>
                </Show>
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
                  disabled={!props.editor || !urlIsValid()}
                  class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="link-confirm-button"
                >
                  {confirmLabel()}
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
