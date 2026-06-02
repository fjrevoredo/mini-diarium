import { createEffect, createSignal, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import type { Editor } from '@tiptap/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from '../../i18n';

interface LinkOverlayProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

type LinkMode = 'edit' | 'wrap-selection' | 'insert';

// Capture the link-relevant editor state at the moment the dialog opens.
// Done as a plain (snapshot) function so the mode, URL, and label do not
// drift while the user is typing in the dialog — the editor's selection
// is unreliable after the input takes focus.
function snapshotEditor(editor: Editor | null): {
  mode: LinkMode;
  initialHref: string;
  initialLabel: string;
} {
  if (!editor) {
    return { mode: 'insert', initialHref: '', initialLabel: '' };
  }
  if (editor.isActive('link')) {
    const href = (editor.getAttributes('link').href as string | undefined) ?? '';
    const { from, to } = editor.state.selection;
    const initialLabel = editor.state.doc.textBetween(from, to, '\n', '\n');
    return { mode: 'edit', initialHref: href, initialLabel };
  }
  const selection = editor.state?.selection;
  if (selection && selection.from !== selection.to) {
    const initialLabel = editor.state.doc.textBetween(selection.from, selection.to, '\n', '\n');
    return { mode: 'wrap-selection', initialHref: '', initialLabel };
  }
  return { mode: 'insert', initialHref: '', initialLabel: '' };
}

// Accept anything that looks plausibly URL-shaped. Bare domains are
// auto-prefixed with https://. Emails → mailto:. Phone numbers → tel:.
// Explicitly unsafe protocols (javascript:, data:, vbscript:, file:) are
// rejected so they can never reach the editor.
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const protocolMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();
    if (['http', 'https', 'mailto', 'tel'].includes(protocol)) {
      return trimmed;
    }
    // Unsafe protocol — reject.
    return '';
  }

  if (trimmed.includes('@') && !/\s/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  if (/^\+?[\d\s().-]+$/.test(trimmed) && /\d/.test(trimmed)) {
    const cleaned = trimmed.replace(/[\s().-]/g, '');
    return `tel:${cleaned}`;
  }
  return `https://${trimmed}`;
}

export default function LinkOverlay(props: LinkOverlayProps) {
  const t = useI18n();
  const [urlInput, setUrlInput] = createSignal('');
  const [labelInput, setLabelInput] = createSignal('');
  const [touched, setTouched] = createSignal(false);
  const [mode, setMode] = createSignal<LinkMode>('insert');
  const [initialLabel, setInitialLabel] = createSignal('');

  // Snapshot mode + initial URL/label ONCE when the dialog opens. We do
  // NOT use a memo that re-reads editor.state on every render, because
  // the editor's selection can change as the user types in the dialog
  // (autofocus steals focus, which TipTap may treat as a selection
  // collapse). The mode, label, and edit-mode URL must stay stable for
  // the lifetime of the dialog.
  createEffect(() => {
    if (!props.isOpen) return;
    const snap = snapshotEditor(props.editor);
    setMode(snap.mode);
    setUrlInput(snap.initialHref);
    setLabelInput(snap.initialLabel);
    setInitialLabel(snap.initialLabel);
    setTouched(false);
  });

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

  const trimmedUrl = () => urlInput().trim();
  const normalizedUrl = () => normalizeUrl(urlInput());
  const trimmedLabel = () => labelInput().trim();

  // URL is valid if the normalized form is non-empty. The normalized form
  // is "" for empty input or for unsafe protocols (javascript:, data:,
  // vbscript:, file:). For bare domains like "example.com", the normalized
  // form is "https://example.com" — valid.
  const urlIsValid = () => normalizedUrl().length > 0;

  const applyLink = () => {
    const editor = props.editor;
    if (!editor) return;
    setTouched(true);
    if (!urlIsValid()) return;

    const href = normalizedUrl();
    // If the label is empty, fall back to what the user typed as the URL
    // (not the auto-prefixed normalized form). This way a bare domain
    // like "example.com" reads as "example.com" in the body, not the
    // auto-prepended "https://example.com" that the user did not type.
    const label = trimmedLabel() || trimmedUrl();
    const currentMode = mode();

    if (currentMode === 'edit') {
      if (trimmedLabel() === initialLabel()) {
        // URL only changed: setLink preserves existing formatting inside the link text
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .deleteSelection()
          .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
          .run();
      }
    } else if (currentMode === 'wrap-selection') {
      if (trimmedLabel() === initialLabel()) {
        // Text unchanged: apply the mark to the existing selection (preserves bold, etc.)
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      } else {
        editor
          .chain()
          .focus()
          .deleteSelection()
          .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
          .run();
      }
    } else {
      // Insert mode — no selection to replace.
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: label,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    }
    props.onClose();
  };

  const handleRemove = () => {
    const editor = props.editor;
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    props.onClose();
  };

  const handleOpenLink = () => {
    const href = normalizedUrl();
    if (!href) return;
    void openUrl(href).catch((err) => {
      console.error('[mini-diarium] failed to open link in system browser:', err);
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    } else if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      applyLink();
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
                  type="text"
                  inputmode="url"
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
                    {t('link.urlRequiredError')}
                  </p>
                </Show>
              </div>

              <div>
                <label for="link-label-input" class="block text-sm font-medium text-secondary mb-2">
                  {t('link.labelLabel')}
                </label>
                <input
                  id="link-label-input"
                  type="text"
                  value={labelInput()}
                  onInput={(e) => setLabelInput(e.currentTarget.value)}
                  placeholder={t('link.labelPlaceholder')}
                  class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="link-label-input"
                />
                <p class="mt-1 text-xs text-tertiary">{t('link.labelHint')}</p>
              </div>

              <p class="text-xs text-tertiary">{t('link.openInBrowserHint')}</p>

              <div class="flex flex-wrap items-center justify-end gap-2">
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
                <Show when={urlIsValid()}>
                  <button
                    type="button"
                    onClick={handleOpenLink}
                    class="px-4 py-2 text-sm font-medium text-secondary bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    data-testid="link-open-button"
                  >
                    {t('link.open')}
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
                  onClick={applyLink}
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
