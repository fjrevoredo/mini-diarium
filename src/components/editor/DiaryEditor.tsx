import { createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Image as TiptapImage } from '@tiptap/extension-image';
import EditorToolbar from './EditorToolbar';
import { preferences } from '../../state/preferences';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  spellCheck?: boolean;
}

async function resizeAndEmbedImage(file: File, editor: Editor): Promise<void> {
  const MAX = 1200; // max dimension in px — caps large photos before base64 embedding
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (w > MAX || h > MAX) {
          if (w >= h) {
            h = Math.round((h * MAX) / w);
            w = MAX;
          } else {
            w = Math.round((w * MAX) / h);
            h = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const useJpeg = file.type === 'image/jpeg' || file.type === 'image/webp';
        resolve(canvas.toDataURL(useJpeg ? 'image/jpeg' : 'image/png', 0.85));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  editor.chain().focus().setImage({ src: dataUrl }).run();
}

export default function DiaryEditor(props: DiaryEditorProps) {
  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={editorElement}; ESLint can't see the JSX assignment
  let editorElement!: HTMLDivElement;
  const [editor, setEditor] = createSignal<Editor | null>(null);

  onMount(() => {
    if (!editorElement) return;

    // Initialize TipTap editor
    const editorInstance = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder: props.placeholder || 'Start writing...',
        }),
        Underline,
        TiptapImage.configure({ allowBase64: true, inline: false }),
      ],
      content: props.content,
      editorProps: {
        attributes: {
          class:
            'diary-editor-content prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
          spellcheck: String(props.spellCheck ?? true),
        },
        handleDrop(_view, event) {
          const dragEvent = event as DragEvent;
          const files = Array.from(dragEvent.dataTransfer?.files ?? []).filter((f) =>
            f.type.startsWith('image/'),
          );
          if (!files.length) return false;
          dragEvent.preventDefault();
          files.forEach((f) =>
            resizeAndEmbedImage(f, editorInstance).catch((err) =>
              console.error('[mini-diarium] image embed failed:', err),
            ),
          );
          return true;
        },
        handlePaste(_view, event) {
          const items = Array.from(event.clipboardData?.items ?? []);
          const imageItems = items.filter((i) => i.type.startsWith('image/'));
          if (!imageItems.length) return false;
          event.preventDefault();
          imageItems.forEach((i) => {
            const file = i.getAsFile();
            if (file)
              resizeAndEmbedImage(file, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              );
          });
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        props.onUpdate?.(html);
      },
    });

    setEditor(editorInstance);

    // Notify parent that editor is ready
    props.onEditorReady?.(editorInstance);
  });

  // Update editor content when prop changes
  createEffect(() => {
    const editorInstance = editor();
    if (editorInstance && props.content !== editorInstance.getHTML()) {
      editorInstance.commands.setContent(props.content);
    }
  });

  // Update spellcheck attribute when prop changes
  createEffect(() => {
    const editorInstance = editor();
    const spellCheck = props.spellCheck ?? true;
    if (editorInstance) {
      const editorElement = editorInstance.view.dom;
      editorElement.setAttribute('spellcheck', String(spellCheck));
    }
  });

  onCleanup(() => {
    editor()?.destroy();
  });

  return (
    <div
      class="rounded-lg border border-primary bg-primary overflow-hidden"
      style={{ '--editor-font-size': `${preferences().editorFontSize}px` }}
    >
      <EditorToolbar
        editor={editor()}
        onInsertImage={(file) => {
          const e = editor();
          if (e)
            resizeAndEmbedImage(file, e).catch((err) =>
              console.error('[mini-diarium] image embed failed:', err),
            );
        }}
      />
      <div class="p-4">
        <div ref={editorElement} />
      </div>
    </div>
  );
}
