import { createEffect, onCleanup, onMount, createSignal, createResource, Show } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import EditorToolbar from './EditorToolbar';
import { AlignableImage } from './extensions/AlignableImage';
import { BidiExtension } from './extensions/BidiExtension';
import { TimestampMark } from './extensions/TimestampMark';
import { LinkWithDialog, handleEditorLinkClick } from './extensions/LinkWithDialog';
import { preferences } from '../../state/preferences';
import { readFileBytes, getFontData } from '../../lib/tauri';
import { extractImageSourcesFromHtml, htmlHasImages } from '../../lib/image-drag';
import { useI18n } from '../../i18n';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  /** Called after a programmatic setContent so EditorPanel can update editorIsEmpty. */
  onSetContent?: (isEmpty: boolean) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  spellCheck?: boolean;
  onImportMarkdown?: () => void;
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
  const t = useI18n();
  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={editorElement}; ESLint can't see the JSX assignment
  let editorElement!: HTMLDivElement;
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [dropHint, setDropHint] = createSignal(false);
  let dropHintTimer: ReturnType<typeof setTimeout> | undefined;

  const showDropHint = () => {
    clearTimeout(dropHintTimer);
    setDropHint(true);
    dropHintTimer = setTimeout(() => setDropHint(false), 6000);
  };

  // @font-face injection: loads the selected editor font from bundled TTF files
  // as base64 data URLs so the browser can render it.
  const fontFamily = () => preferences().editorFontFamily;
  const [fontData] = createResource(fontFamily, getFontData);

  createEffect(() => {
    const existing = document.getElementById('editor-font-face');
    const data = fontData();

    if (!data) {
      existing?.remove();
      return;
    }

    const style = existing || document.createElement('style');
    style.id = 'editor-font-face';
    const faces = [
      `@font-face {`,
      `  font-family: "${data.family}";`,
      `  src: url(${data.regular});`,
      `  font-weight: 400;`,
      `  font-style: normal;`,
      `}`,
    ];
    // When Bold is synthesized (Regular-only upload), omit the 700-weight face so
    // the browser can synthesize bold. Registering a fake 700-weight face pointing
    // at the Regular file would prevent browser synthesis.
    if (!data.bold_synthesized) {
      faces.push(
        `@font-face {`,
        `  font-family: "${data.family}";`,
        `  src: url(${data.bold});`,
        `  font-weight: 700;`,
        `  font-style: normal;`,
        `}`,
      );
    }
    style.textContent = faces.join('\n');

    if (!existing) document.head.appendChild(style);
  });

  onCleanup(() => {
    document.getElementById('editor-font-face')?.remove();
  });

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
          link: false,
        }),
        Placeholder.configure({
          placeholder: () => props.placeholder || 'Start writing...',
        }),
        Underline,
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        AlignableImage.configure({ allowBase64: true, inline: false }),
        TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
        BidiExtension,
        TimestampMark,
        LinkWithDialog,
      ],
      content: props.content,
      editorProps: {
        attributes: {
          class: 'journal-editor-content focus:outline-none max-w-none',
          spellcheck: String(props.spellCheck ?? true),
          dir: 'auto',
        },
        handleClick(_view, _pos, event) {
          return handleEditorLinkClick(event as MouseEvent);
        },
        handleDrop(_view, event) {
          const dragEvent = event as DragEvent;
          const dt = dragEvent.dataTransfer;
          if (!dt) return false;

          const types = Array.from(dt.types ?? []);

          // URL drops: silently consume without inserting or navigating.
          // text/uri-list is present for link drags but also for browser image drags —
          // the image case is distinguished by text/html containing an <img> tag.
          // Returning true calls event.preventDefault() via ProseMirror, which is
          // defense-in-depth alongside the Rust-level on_navigation block.
          if (types.includes('text/uri-list') && !types.includes('Files')) {
            const html = dt.getData('text/html');
            if (!html || !htmlHasImages(html)) {
              dragEvent.preventDefault();
              return true;
            }
          }

          // Path A: File objects — covers virtual files exposed by some cross-app drags.
          const files = Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (files.length) {
            dragEvent.preventDefault();
            files.forEach((f) =>
              resizeAndEmbedImage(f, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              ),
            );
            return true;
          }

          // Path B: HTML payload — Electron/desktop apps (e.g. Typora) expose image drags
          // as text/html with data:image/... or file:// src values. Browsers (Brave, Chrome)
          // only expose HTTPS URLs which we skip — no network fetches. We still consume the
          // drop event when HTTPS images are detected to prevent TipTap from inserting
          // broken <img src="https://..."> nodes as rich text.
          const html = dt.getData('text/html');
          if (html && htmlHasImages(html)) {
            dragEvent.preventDefault();
            const { dataUrls, filePaths } = extractImageSourcesFromHtml(html);
            if (!dataUrls.length && !filePaths.length) {
              // Images are HTTP/HTTPS URLs — can't embed without network access.
              showDropHint();
              return true;
            }
            dataUrls.forEach((url) => {
              const mime = url.split(';')[0].slice(5); // 'data:image/png;...' → 'image/png'
              resizeAndEmbedDataUrl(url, mime, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              );
            });
            filePaths.forEach((path) =>
              resizeAndEmbedPath(path, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              ),
            );
            return true;
          }

          return false;
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
  });

  // Update editor content when prop changes
  createEffect(() => {
    const editorInstance = editor();
    if (editorInstance && props.content !== editorInstance.getHTML()) {
      // Pass emitUpdate:false to suppress onUpdate for programmatic content loads.
      // Without this, loading an entry fires handleContentUpdate which resets the
      // debounce timer with the newly-loaded content, discarding any pending save for
      // the previous entry. It also triggers the "first keystroke creates entry" path
      // on blank days, creating a spurious entry before the user types anything.
      editorInstance.commands.setContent(props.content, { emitUpdate: false });
      // Notify EditorPanel of the new empty state after TipTap processes the content.
      // This replaces the editorIsEmpty update that onUpdate previously provided:
      // EditorPanel uses this signal to re-evaluate addDisabled correctly.
      props.onSetContent?.(editorInstance.isEmpty);
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

  // Dispatch a transaction whenever the placeholder prop changes so ProseMirror re-runs its
  // decoration pass and picks up the new value from the placeholder callback above.
  createEffect(() => {
    const newPlaceholder = props.placeholder; // track reactive dep (locale change)
    const editorInstance = editor();
    if (!editorInstance || editorInstance.isDestroyed) return;
    void newPlaceholder;
    editorInstance.view.dispatch(editorInstance.state.tr);
  });

  onCleanup(() => {
    editor()?.destroy();
    clearTimeout(dropHintTimer);
  });

  return (
    <div
      class={`rounded-lg border bg-primary transition-colors duration-150 ${isDragOver() ? 'editor-drag-over' : 'border-primary'}`}
      style={{
        '--editor-font-size': `${preferences().editorFontSize}px`,
        '--editor-font-family': preferences().editorFontFamily ?? 'inherit',
      }}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer?.types ?? []);
        if (types.includes('Files')) {
          // File drag from OS — we know we can handle it, show the ring.
          setIsDragOver(true);
          e.preventDefault();
        } else if (types.includes('text/html')) {
          // HTML payload drag — we can't read the data yet to know if it contains
          // embeddable images (getData is unavailable in dragover for security reasons),
          // so allow the drop without showing the ring to avoid a false promise.
          e.preventDefault();
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={() => setIsDragOver(false)}
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
        onImportMarkdown={props.onImportMarkdown}
      />
      <div class="p-4">
        <div ref={editorElement} />
      </div>
      <Show when={dropHint()}>
        <div class="mx-4 mb-3 rounded-md border border-primary bg-secondary p-2.5 flex items-start justify-between gap-2">
          <p class="text-xs text-secondary">{t('editor.dropRejectedWebImage')}</p>
          <button
            onClick={() => setDropHint(false)}
            class="text-xs text-tertiary hover:text-primary flex-shrink-0 leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </Show>
    </div>
  );
}
