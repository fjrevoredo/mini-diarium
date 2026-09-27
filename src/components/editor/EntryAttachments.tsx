import { createSignal, createEffect, For, Show, onCleanup, onMount } from 'solid-js';
import type { Editor } from '@tiptap/core';
import {
  File as FileIcon,
  FileText,
  FileVideo,
  Paperclip,
  Download,
  CornerDownLeft,
  X,
} from 'lucide-solid';
import { useI18n } from '../../i18n';
import {
  type AttachmentSummary,
  addEntryAttachment,
  removeEntryAttachment,
  saveAttachmentCopy,
} from '../../lib/tauri';
import {
  entryAttachments,
  attachmentsVersion,
  loadEntryAttachments,
  upsertEntryAttachment,
  removeEntryAttachmentFromList,
  clearEntryAttachments,
  registerSaveCopyHandler,
} from '../../state/entryAttachments';
import { confirmInApp } from '../../state/confirm-dialog';
import { open as openDialog, save as saveDialog } from '../../lib/dialog';
import { mapTauriError } from '../../lib/errors';
import { formatBytes } from '../overlays/image-picker-shared';

interface EntryAttachmentsProps {
  entryId: number;
  /** When true the entry is locked: add/remove/insert are hidden; Save a copy stays (TODO-0071). */
  locked?: boolean;
  /** The entry's editor, for inserting inline refs and checking whether any exist. */
  editor?: Editor | null;
}

/** Basename of a native path (either separator). */
function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** Lower-case extension of a file name without the dot, or null. */
export function fileExtension(name: string): string | null {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : null;
}

function iconFor(mime: string) {
  if (mime.startsWith('video/')) return FileVideo;
  if (mime.startsWith('text/') || mime === 'application/pdf' || mime.includes('document')) {
    return FileText;
  }
  return FileIcon;
}

/**
 * Email-style attachment strip under the editor (TODO-0114): the source of truth for the
 * entry's attachments. File bytes never pass through here — only paths and metadata.
 */
export default function EntryAttachments(props: EntryAttachmentsProps) {
  const t = useI18n();
  const [error, setError] = createSignal<string | null>(null);
  const [isAdding, setIsAdding] = createSignal(false);

  createEffect(() => {
    const id = props.entryId;
    attachmentsVersion(); // reload after a session-level reset (e.g. journal restore)
    setError(null);
    loadEntryAttachments(id).catch((err) => setError(mapTauriError(err, t)));
  });

  onCleanup(() => clearEntryAttachments());

  const handleSaveCopy = async (attachment: AttachmentSummary) => {
    setError(null);
    const entryId = props.entryId;
    const ext = fileExtension(attachment.name);
    let dest: string | null;
    try {
      dest = await saveDialog({
        defaultPath: attachment.name,
        filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
      });
    } catch (err) {
      setError(mapTauriError(err, t));
      return;
    }
    if (!dest) return; // cancelled
    try {
      await saveAttachmentCopy(entryId, attachment.id, dest);
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  // The inline-ref NodeView forwards its clicks here: it has no dialog or error display.
  const handleSaveCopyRequest = (attachmentId: number) => {
    const attachment = entryAttachments().find((a) => a.id === attachmentId);
    if (attachment) void handleSaveCopy(attachment);
  };
  onMount(() => onCleanup(registerSaveCopyHandler(handleSaveCopyRequest)));

  const handleAdd = async () => {
    setError(null);
    const entryId = props.entryId;
    let selected: string | string[] | null;
    try {
      selected = await openDialog({ multiple: true });
    } catch (err) {
      setError(mapTauriError(err, t));
      return;
    }
    if (!selected) return; // cancelled
    const paths = Array.isArray(selected) ? selected : [selected];
    setIsAdding(true);
    const failures: string[] = [];
    try {
      // One invoke per file, so one bad file does not block the others.
      for (const path of paths) {
        try {
          const added = await addEntryAttachment(entryId, path);
          upsertEntryAttachment(entryId, added);
        } catch (err) {
          failures.push(
            t('attachments.addFailed', { name: baseName(path), error: mapTauriError(err, t) }),
          );
        }
      }
    } finally {
      setIsAdding(false);
    }
    if (failures.length > 0) setError(failures.join(' '));
  };

  const hasInlineRefs = (attachmentId: number): boolean => {
    const editor = props.editor;
    if (!editor || editor.isDestroyed) return false;
    return editor.getHTML().includes(`data-attachment-ref="${attachmentId}"`);
  };

  const handleRemove = async (attachment: AttachmentSummary) => {
    setError(null);
    const entryId = props.entryId;
    const message = hasInlineRefs(attachment.id)
      ? t('attachments.confirmRemoveWithRefs', { name: attachment.name })
      : t('attachments.confirmRemove', { name: attachment.name });
    const confirmed = await confirmInApp(message, {
      title: t('attachments.confirmRemoveTitle'),
      confirmLabel: t('attachments.remove'),
    });
    if (!confirmed) return;
    try {
      await removeEntryAttachment(entryId, attachment.id);
      removeEntryAttachmentFromList(entryId, attachment.id);
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleInsertRef = (attachment: AttachmentSummary) => {
    const editor = props.editor;
    if (props.locked || !editor || editor.isDestroyed) return;
    editor.chain().focus().insertAttachmentRef(attachment.id).run();
  };

  return (
    <div
      class="flex flex-wrap items-center gap-1.5 text-xs"
      role="group"
      aria-label={t('attachments.listAria')}
      data-testid="entry-attachments"
    >
      <For each={entryAttachments()}>
        {(attachment) => {
          const Icon = iconFor(attachment.mime_type);
          return (
            <span
              class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 border border-primary bg-tertiary text-secondary"
              role="group"
              aria-label={t('attachments.actionsAria', { name: attachment.name })}
              data-testid="entry-attachment-chip"
            >
              <Icon size={12} aria-hidden="true" />
              <button
                type="button"
                class="max-w-48 truncate hover:opacity-75"
                title={t('attachments.saveCopy')}
                onClick={() => void handleSaveCopy(attachment)}
                data-testid="entry-attachment-save-button"
              >
                {attachment.name}
              </button>
              <span class="text-tertiary">{formatBytes(attachment.byte_size)}</span>
              <button
                type="button"
                class="text-tertiary hover:text-primary"
                title={t('attachments.saveCopy')}
                aria-label={`${t('attachments.saveCopy')} ${attachment.name}`}
                onClick={() => void handleSaveCopy(attachment)}
              >
                <Download size={12} aria-hidden="true" />
              </button>
              <Show when={!props.locked}>
                <Show when={props.editor}>
                  <button
                    type="button"
                    class="text-tertiary hover:text-primary"
                    title={t('attachments.insertRef')}
                    aria-label={`${t('attachments.insertRef')} ${attachment.name}`}
                    onClick={() => handleInsertRef(attachment)}
                    data-testid="entry-attachment-insert-ref-button"
                  >
                    <CornerDownLeft size={12} aria-hidden="true" />
                  </button>
                </Show>
                <button
                  type="button"
                  class="text-tertiary hover:text-primary"
                  title={t('attachments.remove')}
                  aria-label={`${t('attachments.remove')} ${attachment.name}`}
                  onClick={() => void handleRemove(attachment)}
                  data-testid="entry-attachment-remove-button"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </Show>
            </span>
          );
        }}
      </For>

      <Show when={!props.locked}>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-dashed border-primary text-tertiary hover:text-secondary hover:border-secondary transition-colors disabled:opacity-50"
          title={t('attachments.attachFileTitle')}
          disabled={isAdding()}
          onClick={() => void handleAdd()}
          data-testid="entry-attachment-add-button"
        >
          <Paperclip size={12} aria-hidden="true" />
          {t('attachments.attachFile')}
        </button>
      </Show>

      <Show when={error()}>
        <span class="text-error" role="alert">
          {error()}
        </span>
      </Show>
    </div>
  );
}
