import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { preferences } from '../../state/preferences';
import { useI18n } from '../../i18n';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  ImagePlus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-solid';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertImage?: (file: File) => void;
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
  const [activeHeadingLevel, setActiveHeadingLevel] = createSignal(0);
  const [activeAlignment, setActiveAlignment] = createSignal<
    'left' | 'center' | 'right' | 'justify'
  >('left');

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
      setActiveHeadingLevel(
        editor.isActive('heading', { level: 1 })
          ? 1
          : editor.isActive('heading', { level: 2 })
            ? 2
            : editor.isActive('heading', { level: 3 })
              ? 3
              : 0,
      );
      setActiveAlignment(
        editor.isActive({ textAlign: 'center' })
          ? 'center'
          : editor.isActive({ textAlign: 'right' })
            ? 'right'
            : editor.isActive({ textAlign: 'justify' })
              ? 'justify'
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

  return (
    <Show when={props.editor}>
      <div
        role="toolbar"
        aria-label={t('editor.toolbar.aria')}
        class="flex flex-wrap items-center gap-1 border-b border-primary bg-tertiary px-3 py-2"
      >
        {/* Hidden file input for image insertion — always rendered so ref is valid */}
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

        {/* Heading selector + trailing divider — advanced only */}
        <Show when={preferences().advancedToolbar}>
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
          <div aria-hidden="true" class="mx-1 h-6 w-px bg-primary" />
        </Show>

        {/* Bold — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBold().run()}
          class={btnClass(isBoldActive())}
          title={t('editor.toolbar.boldTitle')}
          aria-label={t('editor.toolbar.bold')}
          aria-pressed={isBoldActive()}
        >
          <Bold size={18} />
        </button>

        {/* Italic — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleItalic().run()}
          class={btnClass(isItalicActive())}
          title={t('editor.toolbar.italicTitle')}
          aria-label={t('editor.toolbar.italic')}
          aria-pressed={isItalicActive()}
        >
          <Italic size={18} />
        </button>

        {/* Underline + Strikethrough — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <button
            onClick={() => props.editor?.chain().focus().toggleUnderline().run()}
            class={btnClass(isUnderlineActive())}
            title={t('editor.toolbar.underline')}
            aria-label={t('editor.toolbar.underline')}
            aria-pressed={isUnderlineActive()}
          >
            <Underline size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().toggleStrike().run()}
            class={btnClass(isStrikeActive())}
            title={t('editor.toolbar.strikethrough')}
            aria-label={t('editor.toolbar.strikethrough')}
            aria-pressed={isStrikeActive()}
          >
            <Strikethrough size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().toggleHighlight().run()}
            class={btnClass(isHighlightActive())}
            title={t('editor.toolbar.highlight')}
            aria-label={t('editor.toolbar.highlight')}
            aria-pressed={isHighlightActive()}
          >
            <Highlighter size={18} />
          </button>
        </Show>

        {/* Divider — always, between text-formatting group and list group */}
        <div aria-hidden="true" class="mx-1 h-6 w-px bg-primary" />

        {/* Blockquote, Inline Code + trailing divider — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <button
            onClick={() => props.editor?.chain().focus().toggleBlockquote().run()}
            class={btnClass(isBlockquoteActive())}
            title={t('editor.toolbar.blockquote')}
            aria-label={t('editor.toolbar.blockquote')}
            aria-pressed={isBlockquoteActive()}
          >
            <Quote size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().toggleCode().run()}
            class={btnClass(isCodeActive())}
            title={t('editor.toolbar.inlineCode')}
            aria-label={t('editor.toolbar.inlineCode')}
            aria-pressed={isCodeActive()}
          >
            <Code size={18} />
          </button>
          <div aria-hidden="true" class="mx-1 h-6 w-px bg-primary" />
        </Show>

        {/* Bullet List — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBulletList().run()}
          class={btnClass(isBulletListActive())}
          title={t('editor.toolbar.bulletList')}
          aria-label={t('editor.toolbar.bulletList')}
          aria-pressed={isBulletListActive()}
        >
          <List size={18} />
        </button>

        {/* Ordered List — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleOrderedList().run()}
          class={btnClass(isOrderedListActive())}
          title={t('editor.toolbar.numberedList')}
          aria-label={t('editor.toolbar.numberedList')}
          aria-pressed={isOrderedListActive()}
        >
          <ListOrdered size={18} />
        </button>

        {/* Leading divider + Horizontal Rule — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <div aria-hidden="true" class="mx-1 h-6 w-px bg-primary" />
          <button
            onClick={() => props.editor?.chain().focus().setHorizontalRule().run()}
            class={btnBase}
            title={t('editor.toolbar.horizontalRule')}
            aria-label={t('editor.toolbar.horizontalRule')}
          >
            <Minus size={18} />
          </button>
        </Show>

        {/* Insert Image — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <button
            onClick={() => fileInputRef.click()}
            class={btnBase}
            title={t('editor.toolbar.insertImage')}
            aria-label={t('editor.toolbar.insertImage')}
          >
            <ImagePlus size={18} />
          </button>
        </Show>

        {/* Alignment controls — advanced only */}
        <Show when={preferences().advancedToolbar}>
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
        </Show>
      </div>
    </Show>
  );
}
