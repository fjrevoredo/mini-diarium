import { createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import EditorToolbar from './EditorToolbar';
import { preferences } from '../../state/preferences';
import { readFileBytes } from '../../lib/tauri';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  spellCheck?: boolean;
}

// Core: resize a data URL via canvas and insert at the current cursor position.
async function resizeAndEmbedDataUrl(
  dataUrl: string,
  mimeHint: string,
  editor: Editor,
): Promise<void> {
  const MAX = 1200; // max dimension in px — caps large photos before base64 embedding
  const resized = await new Promise<string>((resolve, reject) => {
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
      const useJpeg = mimeHint === 'image/jpeg' || mimeHint === 'image/webp';
      resolve(canvas.toDataURL(useJpeg ? 'image/jpeg' : 'image/png', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
  editor.chain().focus().setImage({ src: resized }).run();
}

// For browser File objects: clipboard paste and toolbar file picker.
async function resizeAndEmbedImage(file: File, editor: Editor): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  await resizeAndEmbedDataUrl(dataUrl, file.type, editor);
}

// For file paths from the Tauri drag-drop event.
// Tauri intercepts OS-level drops on all platforms and emits tauri://drag-drop
// instead of populating event.dataTransfer.files in the browser's drop event.
async function resizeAndEmbedPath(path: string, editor: Editor): Promise<void> {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'bmp'
            ? 'image/bmp'
            : 'image/png';
  const bytes = await readFileBytes(path);
  const uint8 = new Uint8Array(bytes);
  let binary = '';
  uint8.forEach((b) => (binary += String.fromCharCode(b)));
  await resizeAndEmbedDataUrl(`data:${mime};base64,${btoa(binary)}`, mime, editor);
}

export default function DiaryEditor(props: DiaryEditorProps) {
  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={editorElement}; ESLint can't see the JSX assignment
  let editorElement!: HTMLDivElement;
  const [editor, setEditor] = createSignal<Editor | null>(null);
  let unlistenDragDrop: UnlistenFn | undefined;

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
        Highlight,
        TiptapImage.configure({ allowBase64: true, inline: false }),
      ],
      content: props.content,
      editorProps: {
        attributes: {
          class:
            'journal-editor-content prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
          spellcheck: String(props.spellCheck ?? true),
        },
        // Fallback for when Tauri's file-drop interception is disabled or absent.
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
    props.onEditorReady?.(editorInstance);

    // Tauri intercepts OS-level file drops on all platforms and emits tauri://drag-drop
    // instead of letting the browser's drop event see the files via dataTransfer.files.
    listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      const imagePaths = event.payload.paths.filter((p) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(p));
      imagePaths.forEach((path) =>
        resizeAndEmbedPath(path, editorInstance).catch((err) =>
          console.error('[mini-diarium] image embed failed:', err),
        ),
      );
    }).then((fn) => {
      unlistenDragDrop = fn;
    });
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
    unlistenDragDrop?.();
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
