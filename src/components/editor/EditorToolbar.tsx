import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { Bold, Italic, List, ListOrdered } from 'lucide-solid';

interface EditorToolbarProps {
  editor: Editor | null;
}

export default function EditorToolbar(props: EditorToolbarProps) {
  // Reactive signals for active states
  const [isBoldActive, setIsBoldActive] = createSignal(false);
  const [isItalicActive, setIsItalicActive] = createSignal(false);
  const [isBulletListActive, setIsBulletListActive] = createSignal(false);
  const [isOrderedListActive, setIsOrderedListActive] = createSignal(false);

  // Update active states when editor changes
  createEffect(() => {
    const editor = props.editor;
    if (!editor) return;

    // Update active states based on current editor state
    const updateActiveStates = () => {
      setIsBoldActive(editor.isActive('bold'));
      setIsItalicActive(editor.isActive('italic'));
      setIsBulletListActive(editor.isActive('bulletList'));
      setIsOrderedListActive(editor.isActive('orderedList'));
    };

    // Initial update
    updateActiveStates();

    // Listen to editor updates for active state changes
    editor.on('selectionUpdate', updateActiveStates);
    editor.on('transaction', updateActiveStates);

    // Cleanup listeners
    onCleanup(() => {
      editor.off('selectionUpdate', updateActiveStates);
      editor.off('transaction', updateActiveStates);
    });
  });

  const toggleBold = () => {
    props.editor?.chain().focus().toggleBold().run();
  };

  const toggleItalic = () => {
    props.editor?.chain().focus().toggleItalic().run();
  };

  const toggleBulletList = () => {
    props.editor?.chain().focus().toggleBulletList().run();
  };

  const toggleOrderedList = () => {
    props.editor?.chain().focus().toggleOrderedList().run();
  };

  return (
    <Show when={props.editor}>
      <div class="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
        {/* Bold Button */}
        <button
          onClick={toggleBold}
          class={`rounded p-2 transition-colors ${
            isBoldActive()
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          title="Bold (Ctrl/Cmd+B)"
          aria-label="Bold"
        >
          <Bold size={20} />
        </button>

        {/* Italic Button */}
        <button
          onClick={toggleItalic}
          class={`rounded p-2 transition-colors ${
            isItalicActive()
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          title="Italic (Ctrl/Cmd+I)"
          aria-label="Italic"
        >
          <Italic size={20} />
        </button>

        {/* Divider */}
        <div class="mx-1 h-6 w-px bg-gray-300" />

        {/* Bullet List Button */}
        <button
          onClick={toggleBulletList}
          class={`rounded p-2 transition-colors ${
            isBulletListActive()
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          title="Bullet List"
          aria-label="Bullet List"
        >
          <List size={20} />
        </button>

        {/* Ordered List Button */}
        <button
          onClick={toggleOrderedList}
          class={`rounded p-2 transition-colors ${
            isOrderedListActive()
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered size={20} />
        </button>
      </div>
    </Show>
  );
}
