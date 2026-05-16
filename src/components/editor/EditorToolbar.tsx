import { Show, For, createSignal, createEffect, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { preferences } from '../../state/preferences';
import type { ToolbarItemKey } from '../../state/preferences';
import { useI18n } from '../../i18n';
import TimestampOverlay from './TimestampOverlay';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Type,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  ImagePlus,
  FileInput,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Clock,
  PilcrowLeft,
  PilcrowRight,
} from 'lucide-solid';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertImage?: (file: File) => void;
  onImportMarkdown?: () => void;
}

export default function EditorToolbar(props: EditorToolbarProps) {
  const t = useI18n();

  // Reactive signals for active states
  const [isBoldActive, setIsBoldActive] = createSignal(false);
  const [isItalicActive, setIsItalicActive] = createSignal(false);
  const [isUnderlineActive, setIsUnderlineActive] = createSignal(false);
  const [isStrikeActive, setIsStrikeActive] = createSignal(false);
  const [isBulletListActive, setIsBulletListActive] = createSignal(false);
  const [isOrderedListActive, setIsOrderedListActive] = createSignal(false);
  const [isBlockquoteActive, setIsBlockquoteActive] = createSignal(false);
  const [isCodeActive, setIsCodeActive] = createSignal(false);
  const [isHighlightActive, setIsHighlightActive] = createSignal(false);
  const [activeTextColor, setActiveTextColor] = createSignal<string | null>(null);
  const [activeHighlightColor, setActiveHighlightColor] = createSignal<string | null>(null);
  const [activeHeadingLevel, setActiveHeadingLevel] = createSignal(0);
  const [activeAlignment, setActiveAlignment] = createSignal<
    'left' | 'center' | 'right' | 'justify'
  >('left');
  const [isTimestampOpen, setIsTimestampOpen] = createSignal(false);
  const [isRtlActive, setIsRtlActive] = createSignal(false);

  // Update active states when editor changes
  createEffect(() => {
    const editor = props.editor;
    if (!editor) return;

    const updateActiveStates = () => {
      setIsBoldActive(editor.isActive('bold'));
      setIsItalicActive(editor.isActive('italic'));
      setIsUnderlineActive(editor.isActive('underline'));
      setIsStrikeActive(editor.isActive('strike'));
      setIsBulletListActive(editor.isActive('bulletList'));
      setIsOrderedListActive(editor.isActive('orderedList'));
      setIsBlockquoteActive(editor.isActive('blockquote'));
      setIsCodeActive(editor.isActive('code'));
      setIsHighlightActive(editor.isActive('highlight'));
      setActiveTextColor(editor.getAttributes('textStyle').color ?? null);
      setActiveHighlightColor(editor.getAttributes('highlight').color ?? null);
      setActiveHeadingLevel(
        editor.isActive('heading', { level: 1 })
          ? 1
          : editor.isActive('heading', { level: 2 })
            ? 2
            : editor.isActive('heading', { level: 3 })
              ? 3
              : 0,
      );
      const dir = editor.getAttributes('paragraph').dir ?? editor.getAttributes('heading').dir;
      const isRtlDefault = dir === 'rtl';
      setIsRtlActive(isRtlDefault);
      setActiveAlignment(
        editor.isActive({ textAlign: 'center' })
          ? 'center'
          : editor.isActive({ textAlign: 'right' })
            ? 'right'
            : editor.isActive({ textAlign: 'justify' })
              ? 'justify'
              : editor.isActive({ textAlign: 'left' })
                ? 'left'
                : isRtlDefault
                  ? 'right'
                  : 'left',
      );
    };

    updateActiveStates();

    editor.on('selectionUpdate', updateActiveStates);
    editor.on('transaction', updateActiveStates);

    onCleanup(() => {
      editor.off('selectionUpdate', updateActiveStates);
      editor.off('transaction', updateActiveStates);
    });
  });

  const btnBase =
    'rounded p-2 transition-colors text-secondary hover:bg-tertiary hover:text-primary';
  const btnActive = 'rounded p-2 transition-colors btn-active';

  const btnClass = (active: boolean) => (active ? btnActive : btnBase);

  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={fileInputRef}; ESLint can't see the JSX assignment
  let fileInputRef!: HTMLInputElement;
  // eslint-disable-next-line no-unassigned-vars
  let textColorInputRef!: HTMLInputElement;
  // eslint-disable-next-line no-unassigned-vars
  let highlightColorInputRef!: HTMLInputElement;

  const DEFAULT_TEXT_COLOR = '#000000';
  const DEFAULT_HIGHLIGHT_COLOR = '#fef08a';

  const handleTextColorChange = (color: string) => {
    const ed = props.editor;
    if (!ed) return;
    if (activeTextColor() === color) {
      ed.chain().focus().unsetColor().run();
    } else {
      ed.chain().focus().setColor(color).run();
    }
  };

  const handleHighlightColorChange = (color: string) => {
    const ed = props.editor;
    if (!ed) return;
    ed.chain().focus().toggleHighlight({ color }).run();
  };

  const renderItem = (key: ToolbarItemKey): JSX.Element => {
    switch (key) {
      case 'headings':
        return (
          <select
            aria-label={t('editor.toolbar.textStyle')}
            value={String(activeHeadingLevel())}
            onChange={(e) => {
              const lvl = parseInt(e.target.value);
              if (lvl === 0) {
                props.editor?.chain().focus().setParagraph().run();
              } else {
                props.editor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: lvl as 1 | 2 | 3 })
                  .run();
              }
            }}
            class="h-8 rounded border border-primary bg-primary px-2 text-sm text-primary transition-colors hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          >
            <option value="0">{t('editor.toolbar.normal')}</option>
            <option value="1">{t('editor.toolbar.heading1')}</option>
            <option value="2">{t('editor.toolbar.heading2')}</option>
            <option value="3">{t('editor.toolbar.heading3')}</option>
          </select>
        );
      case 'underline':
        return (
          <button
            onClick={() => props.editor?.chain().focus().toggleUnderline().run()}
            class={btnClass(isUnderlineActive())}
            title={t('editor.toolbar.underline')}
            aria-label={t('editor.toolbar.underline')}
            aria-pressed={isUnderlineActive()}
          >
            <Underline size={18} />
          </button>
        );
      case 'strikethrough':
        return (
          <button
            onClick={() => props.editor?.chain().focus().toggleStrike().run()}
            class={btnClass(isStrikeActive())}
            title={t('editor.toolbar.strikethrough')}
            aria-label={t('editor.toolbar.strikethrough')}
            aria-pressed={isStrikeActive()}
          >
            <Strikethrough size={18} />
          </button>
        );
      case 'textColor':
        return (
          <button
            onClick={() => textColorInputRef?.click()}
            class={btnClass(!!activeTextColor())}
            title={t('editor.toolbar.textColor')}
            aria-label={t('editor.toolbar.textColor')}
            aria-pressed={!!activeTextColor()}
          >
            <span class="relative inline-flex flex-col items-center">
              <Type size={18} />
              <span
                class="mt-0.5 h-0.5 w-3.5 rounded-full"
                style={{
                  'background-color': activeTextColor() ?? DEFAULT_TEXT_COLOR,
                }}
              />
            </span>
          </button>
        );
      case 'highlightColor':
        return (
          <button
            onClick={() => highlightColorInputRef?.click()}
            class={btnClass(isHighlightActive())}
            title={t('editor.toolbar.highlightColor')}
            aria-label={t('editor.toolbar.highlightColor')}
            aria-pressed={isHighlightActive()}
          >
            <span class="relative inline-flex flex-col items-center">
              <Highlighter size={18} />
              <span
                class="mt-0.5 h-0.5 w-3.5 rounded-full"
                style={{
                  'background-color': activeHighlightColor() ?? DEFAULT_HIGHLIGHT_COLOR,
                }}
              />
            </span>
          </button>
        );
      case 'blockquote':
        return (
          <button
            onClick={() => props.editor?.chain().focus().toggleBlockquote().run()}
            class={btnClass(isBlockquoteActive())}
            title={t('editor.toolbar.blockquote')}
            aria-label={t('editor.toolbar.blockquote')}
            aria-pressed={isBlockquoteActive()}
          >
            <Quote size={18} />
          </button>
        );
      case 'inlineCode':
        return (
          <button
            onClick={() => props.editor?.chain().focus().toggleCode().run()}
            class={btnClass(isCodeActive())}
            title={t('editor.toolbar.inlineCode')}
            aria-label={t('editor.toolbar.inlineCode')}
            aria-pressed={isCodeActive()}
          >
            <Code size={18} />
          </button>
        );
      case 'bulletList':
        return (
          <button
            onClick={() => props.editor?.chain().focus().toggleBulletList().run()}
            class={btnClass(isBulletListActive())}
            title={t('editor.toolbar.bulletList')}
            aria-label={t('editor.toolbar.bulletList')}
            aria-pressed={isBulletListActive()}
          >
            <List size={18} />
          </button>
        );
      case 'orderedList':
        return (
          <button
            onClick={() => props.editor?.chain().focus().toggleOrderedList().run()}
            class={btnClass(isOrderedListActive())}
            title={t('editor.toolbar.numberedList')}
            aria-label={t('editor.toolbar.numberedList')}
            aria-pressed={isOrderedListActive()}
          >
            <ListOrdered size={18} />
          </button>
        );
      case 'horizontalRule':
        return (
          <button
            onClick={() => props.editor?.chain().focus().setHorizontalRule().run()}
            class={btnBase}
            title={t('editor.toolbar.horizontalRule')}
            aria-label={t('editor.toolbar.horizontalRule')}
          >
            <Minus size={18} />
          </button>
        );
      case 'insertImage':
        return (
          <button
            onClick={() => fileInputRef.click()}
            class={btnBase}
            title={t('editor.toolbar.insertImage')}
            aria-label={t('editor.toolbar.insertImage')}
          >
            <ImagePlus size={18} />
          </button>
        );
      case 'importMarkdown':
        return (
          <button
            onClick={() => props.onImportMarkdown?.()}
            class={btnBase}
            title={t('editor.toolbar.importMarkdown')}
            aria-label={t('editor.toolbar.importMarkdown')}
          >
            <FileInput size={18} />
          </button>
        );
      case 'insertTimestamp':
        return (
          <button
            onClick={() => setIsTimestampOpen(true)}
            class={btnBase}
            title={t('editor.toolbar.insertTimestampTitle')}
            aria-label={t('editor.toolbar.insertTimestamp')}
            data-testid="insert-timestamp-button"
          >
            <Clock size={18} />
          </button>
        );
      case 'textDirection':
        return (
          <button
            onClick={() => {
              const ed = props.editor;
              if (!ed) return;
              const pd = ed.getAttributes('paragraph').dir as string | null | undefined;
              const hd = ed.getAttributes('heading').dir as string | null | undefined;
              const cur = pd ?? hd ?? null;
              const next = cur === 'rtl' ? ('ltr' as const) : ('rtl' as const);
              ed.chain().focus().setTextDirection(next).run();
            }}
            class={btnClass(isRtlActive())}
            title={t('editor.toolbar.textDirectionTitle')}
            aria-label={t('editor.toolbar.textDirection')}
            aria-pressed={isRtlActive()}
          >
            {isRtlActive() ? <PilcrowLeft size={18} /> : <PilcrowRight size={18} />}
          </button>
        );
      case 'alignment':
        return (
          <>
            <div aria-hidden="true" class="mx-1 h-6 w-px bg-primary" />
            <button
              onClick={() => props.editor?.chain().focus().setTextAlign('left').run()}
              class={btnClass(activeAlignment() === 'left')}
              title={t('editor.toolbar.alignLeft')}
              aria-label={t('editor.toolbar.alignLeft')}
              aria-pressed={activeAlignment() === 'left'}
            >
              <AlignLeft size={18} />
            </button>
            <button
              onClick={() => props.editor?.chain().focus().setTextAlign('center').run()}
              class={btnClass(activeAlignment() === 'center')}
              title={t('editor.toolbar.alignCenter')}
              aria-label={t('editor.toolbar.alignCenter')}
              aria-pressed={activeAlignment() === 'center'}
            >
              <AlignCenter size={18} />
            </button>
            <button
              onClick={() => props.editor?.chain().focus().setTextAlign('right').run()}
              class={btnClass(activeAlignment() === 'right')}
              title={t('editor.toolbar.alignRight')}
              aria-label={t('editor.toolbar.alignRight')}
              aria-pressed={activeAlignment() === 'right'}
            >
              <AlignRight size={18} />
            </button>
            <button
              onClick={() => props.editor?.chain().focus().setTextAlign('justify').run()}
              class={btnClass(activeAlignment() === 'justify')}
              title={t('editor.toolbar.justify')}
              aria-label={t('editor.toolbar.justify')}
              aria-pressed={activeAlignment() === 'justify'}
            >
              <AlignJustify size={18} />
            </button>
          </>
        );
    }
  };

  return (
    <Show when={props.editor}>
      <div
        role="toolbar"
        data-tour-target="toolbar"
        aria-label={t('editor.toolbar.aria')}
        class="flex flex-wrap items-center gap-1 border-b border-primary bg-tertiary px-3 py-2"
      >
        {/* Hidden inputs — always rendered so refs are valid for click triggers */}
        <input
          type="file"
          accept="image/*"
          class="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onInsertImage?.(file);
            e.target.value = '';
          }}
        />
        <input
          ref={textColorInputRef}
          type="color"
          class="sr-only"
          value={activeTextColor() ?? DEFAULT_TEXT_COLOR}
          onInput={(e) => handleTextColorChange(e.currentTarget.value)}
          aria-hidden="true"
        />
        <input
          ref={highlightColorInputRef}
          type="color"
          class="sr-only"
          value={activeHighlightColor() ?? DEFAULT_HIGHLIGHT_COLOR}
          onInput={(e) => handleHighlightColorChange(e.currentTarget.value)}
          aria-hidden="true"
        />

        {/* Fixed: Bold, Italic */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBold().run()}
          class={btnClass(isBoldActive())}
          title={t('editor.toolbar.boldTitle')}
          aria-label={t('editor.toolbar.bold')}
          aria-pressed={isBoldActive()}
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => props.editor?.chain().focus().toggleItalic().run()}
          class={btnClass(isItalicActive())}
          title={t('editor.toolbar.italicTitle')}
          aria-label={t('editor.toolbar.italic')}
          aria-pressed={isItalicActive()}
        >
          <Italic size={18} />
        </button>
        <div aria-hidden="true" class="mx-1 h-6 w-px bg-primary" />

        {/* Configurable items in user-defined order */}
        <For each={preferences().toolbarItems}>
          {(item) => <Show when={item.enabled}>{renderItem(item.key)}</Show>}
        </For>

        <TimestampOverlay
          editor={props.editor}
          isOpen={isTimestampOpen()}
          onClose={() => setIsTimestampOpen(false)}
        />
      </div>
    </Show>
  );
}
