import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Editor } from '@tiptap/core';

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
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
            />
          </svg>
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
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <line x1="19" y1="4" x2="10" y2="4" stroke-linecap="round" stroke-width="2" />
            <line x1="14" y1="20" x2="5" y2="20" stroke-linecap="round" stroke-width="2" />
            <line x1="15" y1="4" x2="9" y2="20" stroke-linecap="round" stroke-width="2" />
          </svg>
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
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <line x1="9" y1="6" x2="20" y2="6" stroke-linecap="round" stroke-width="2" />
            <line x1="9" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="2" />
            <line x1="9" y1="18" x2="20" y2="18" stroke-linecap="round" stroke-width="2" />
            <circle cx="5" cy="6" r="1" fill="currentColor" />
            <circle cx="5" cy="12" r="1" fill="currentColor" />
            <circle cx="5" cy="18" r="1" fill="currentColor" />
          </svg>
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
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <line x1="12" y1="6" x2="21" y2="6" stroke-linecap="round" stroke-width="2" />
            <line x1="12" y1="12" x2="21" y2="12" stroke-linecap="round" stroke-width="2" />
            <line x1="12" y1="18" x2="21" y2="18" stroke-linecap="round" stroke-width="2" />
            <path d="M3 5v2m0 0v2m0-2h2" stroke-linecap="round" stroke-width="1.5" />
            <path d="M3 11v2m0 0v2m0-2h2" stroke-linecap="round" stroke-width="1.5" />
            <path d="M3 17v2m0 0v2m0-2h2" stroke-linecap="round" stroke-width="1.5" />
          </svg>
        </button>
      </div>
    </Show>
  );
}
