import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { preferences } from '../../state/preferences';
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
      <div class="flex flex-wrap items-center gap-1 border-b border-primary bg-tertiary px-3 py-2">
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
            aria-label="Text style"
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
            <option value="0">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>
          <div class="mx-1 h-6 w-px bg-primary" />
        </Show>

        {/* Bold — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBold().run()}
          class={btnClass(isBoldActive())}
          title="Bold (Ctrl/Cmd+B)"
          aria-label="Bold"
        >
          <Bold size={18} />
        </button>

        {/* Italic — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleItalic().run()}
          class={btnClass(isItalicActive())}
          title="Italic (Ctrl/Cmd+I)"
          aria-label="Italic"
        >
          <Italic size={18} />
        </button>

        {/* Underline + Strikethrough — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <button
            onClick={() => props.editor?.chain().focus().toggleUnderline().run()}
            class={btnClass(isUnderlineActive())}
            title="Underline (Ctrl/Cmd+U)"
            aria-label="Underline (Ctrl/Cmd+U)"
          >
            <Underline size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().toggleStrike().run()}
            class={btnClass(isStrikeActive())}
            title="Strikethrough (Ctrl/Cmd+Shift+S)"
            aria-label="Strikethrough (Ctrl/Cmd+Shift+S)"
          >
            <Strikethrough size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().toggleHighlight().run()}
            class={btnClass(isHighlightActive())}
            title="Highlight (Ctrl/Cmd+Shift+H)"
            aria-label="Highlight (Ctrl/Cmd+Shift+H)"
          >
            <Highlighter size={18} />
          </button>
        </Show>

        {/* Divider — always, between text-formatting group and list group */}
        <div class="mx-1 h-6 w-px bg-primary" />

        {/* Blockquote, Inline Code + trailing divider — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <button
            onClick={() => props.editor?.chain().focus().toggleBlockquote().run()}
            class={btnClass(isBlockquoteActive())}
            title="Blockquote (Ctrl/Cmd+Shift+B)"
            aria-label="Blockquote (Ctrl/Cmd+Shift+B)"
          >
            <Quote size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().toggleCode().run()}
            class={btnClass(isCodeActive())}
            title="Inline Code (Ctrl/Cmd+E)"
            aria-label="Inline Code (Ctrl/Cmd+E)"
          >
            <Code size={18} />
          </button>
          <div class="mx-1 h-6 w-px bg-primary" />
        </Show>

        {/* Bullet List — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBulletList().run()}
          class={btnClass(isBulletListActive())}
          title="Bullet List"
          aria-label="Bullet List"
        >
          <List size={18} />
        </button>

        {/* Ordered List — always */}
        <button
          onClick={() => props.editor?.chain().focus().toggleOrderedList().run()}
          class={btnClass(isOrderedListActive())}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered size={18} />
        </button>

        {/* Leading divider + Horizontal Rule — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <div class="mx-1 h-6 w-px bg-primary" />
          <button
            onClick={() => props.editor?.chain().focus().setHorizontalRule().run()}
            class={btnBase}
            title="Insert horizontal rule"
            aria-label="Insert horizontal rule"
          >
            <Minus size={18} />
          </button>
        </Show>

        {/* Insert Image — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <button
            onClick={() => fileInputRef.click()}
            class={btnBase}
            title="Insert image"
            aria-label="Insert image"
          >
            <ImagePlus size={18} />
          </button>
        </Show>

        {/* Alignment controls — advanced only */}
        <Show when={preferences().advancedToolbar}>
          <div class="mx-1 h-6 w-px bg-primary" />
          <button
            onClick={() => props.editor?.chain().focus().setTextAlign('left').run()}
            class={btnClass(activeAlignment() === 'left')}
            title="Align left"
            aria-label="Align left"
          >
            <AlignLeft size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().setTextAlign('center').run()}
            class={btnClass(activeAlignment() === 'center')}
            title="Align center"
            aria-label="Align center"
          >
            <AlignCenter size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().setTextAlign('right').run()}
            class={btnClass(activeAlignment() === 'right')}
            title="Align right"
            aria-label="Align right"
          >
            <AlignRight size={18} />
          </button>
          <button
            onClick={() => props.editor?.chain().focus().setTextAlign('justify').run()}
            class={btnClass(activeAlignment() === 'justify')}
            title="Justify"
            aria-label="Justify"
          >
            <AlignJustify size={18} />
          </button>
        </Show>
      </div>
    </Show>
  );
}
