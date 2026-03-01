import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Editor } from '@tiptap/core';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
} from 'lucide-solid';

interface EditorToolbarProps {
  editor: Editor | null;
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
  const [activeHeadingLevel, setActiveHeadingLevel] = createSignal(0);

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
      setActiveHeadingLevel(
        editor.isActive('heading', { level: 1 })
          ? 1
          : editor.isActive('heading', { level: 2 })
            ? 2
            : editor.isActive('heading', { level: 3 })
              ? 3
              : 0,
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
  const btnActive = 'rounded p-2 transition-colors bg-blue-100 text-blue-700';

  const btnClass = (active: boolean) => (active ? btnActive : btnBase);

  return (
    <Show when={props.editor}>
      <div class="flex flex-wrap items-center gap-1 border-b border-primary bg-tertiary px-3 py-2">
        {/* Heading selector */}
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
          class="h-8 rounded border border-primary bg-primary px-2 text-sm text-primary transition-colors hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="0">Normal</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        {/* Divider */}
        <div class="mx-1 h-6 w-px bg-primary" />

        {/* Bold */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBold().run()}
          class={btnClass(isBoldActive())}
          title="Bold (Ctrl/Cmd+B)"
          aria-label="Bold"
        >
          <Bold size={18} />
        </button>

        {/* Italic */}
        <button
          onClick={() => props.editor?.chain().focus().toggleItalic().run()}
          class={btnClass(isItalicActive())}
          title="Italic (Ctrl/Cmd+I)"
          aria-label="Italic"
        >
          <Italic size={18} />
        </button>

        {/* Underline */}
        <button
          onClick={() => props.editor?.chain().focus().toggleUnderline().run()}
          class={btnClass(isUnderlineActive())}
          title="Underline (Ctrl/Cmd+U)"
          aria-label="Underline (Ctrl/Cmd+U)"
        >
          <Underline size={18} />
        </button>

        {/* Strikethrough */}
        <button
          onClick={() => props.editor?.chain().focus().toggleStrike().run()}
          class={btnClass(isStrikeActive())}
          title="Strikethrough (Ctrl/Cmd+Shift+S)"
          aria-label="Strikethrough (Ctrl/Cmd+Shift+S)"
        >
          <Strikethrough size={18} />
        </button>

        {/* Divider */}
        <div class="mx-1 h-6 w-px bg-primary" />

        {/* Blockquote */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBlockquote().run()}
          class={btnClass(isBlockquoteActive())}
          title="Blockquote (Ctrl/Cmd+Shift+B)"
          aria-label="Blockquote (Ctrl/Cmd+Shift+B)"
        >
          <Quote size={18} />
        </button>

        {/* Inline Code */}
        <button
          onClick={() => props.editor?.chain().focus().toggleCode().run()}
          class={btnClass(isCodeActive())}
          title="Inline Code (Ctrl/Cmd+E)"
          aria-label="Inline Code (Ctrl/Cmd+E)"
        >
          <Code size={18} />
        </button>

        {/* Divider */}
        <div class="mx-1 h-6 w-px bg-primary" />

        {/* Bullet List */}
        <button
          onClick={() => props.editor?.chain().focus().toggleBulletList().run()}
          class={btnClass(isBulletListActive())}
          title="Bullet List"
          aria-label="Bullet List"
        >
          <List size={18} />
        </button>

        {/* Ordered List */}
        <button
          onClick={() => props.editor?.chain().focus().toggleOrderedList().run()}
          class={btnClass(isOrderedListActive())}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered size={18} />
        </button>

        {/* Divider */}
        <div class="mx-1 h-6 w-px bg-primary" />

        {/* Horizontal Rule */}
        <button
          onClick={() => props.editor?.chain().focus().setHorizontalRule().run()}
          class={btnBase}
          title="Insert horizontal rule"
          aria-label="Insert horizontal rule"
        >
          <Minus size={18} />
        </button>
      </div>
    </Show>
  );
}
