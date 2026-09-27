import { Node, mergeAttributes } from '@tiptap/core';
import { createRoot, createEffect } from 'solid-js';
import {
  entryAttachments,
  attachmentsLoaded,
  requestSaveAttachmentCopy,
} from '../../../state/entryAttachments';

export interface AttachmentRefOptions {
  /** Label for a ref whose attachment is no longer linked to the entry. */
  missingLabel: () => string;
  /** Tooltip for a resolved ref. */
  titleFor: (name: string) => string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachmentRef: {
      /** Inserts an inline reference to one of the entry's attachments. No-op when read-only. */
      insertAttachmentRef: (attachmentId: number) => ReturnType;
    };
  }
}

/** Parses a positive integer id from the attribute, or null. */
export function parseAttachmentRefId(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const id = Number(value.trim());
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Inline pointer to an attachment of the same entry (TODO-0114). Serialized as
 * `<span data-attachment-ref="N"></span>` — the id only. The name is resolved at render
 * time from the entry's attachment list, so the node never owns the attachment: removing
 * the attachment leaves the ref in place, rendered as "missing".
 */
export const AttachmentRef = Node.create<AttachmentRefOptions>({
  name: 'attachmentRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      missingLabel: () => 'Missing attachment',
      titleFor: (name: string) => name,
    };
  },

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          parseAttachmentRefId(el.getAttribute('data-attachment-ref')),
        renderHTML: (attrs: { attachmentId: number | null }) =>
          attrs.attachmentId === null ? {} : { 'data-attachment-ref': String(attrs.attachmentId) },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-attachment-ref]',
        // Above the TextStyle span rule, so a ref span never parses as a styled text run.
        priority: 100,
        getAttrs: (el) =>
          parseAttachmentRefId((el as HTMLElement).getAttribute('data-attachment-ref')) === null
            ? false
            : null,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Keep only the id attribute: names are resolved at render time, never stored.
    return ['span', mergeAttributes(HTMLAttributes)];
  },

  renderText() {
    // Contributes no words to getText() (word count, empty check).
    return '';
  },

  addCommands() {
    return {
      insertAttachmentRef:
        (attachmentId: number) =>
        ({ editor, commands }) => {
          // setEditable(false) blocks typing only; a programmatic insert would still
          // change a locked entry, so refuse it here.
          if (!editor.isEditable) return false;
          return commands.insertContent({ type: this.name, attrs: { attachmentId } });
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const id = node.attrs.attachmentId as number | null;
      const dom = document.createElement('span');
      dom.className = 'attachment-ref';
      dom.contentEditable = 'false';
      dom.setAttribute('data-attachment-ref', String(id ?? ''));

      const dispose = createRoot((disposeRoot) => {
        createEffect(() => {
          const attachment = entryAttachments().find((a) => a.id === id);
          const missing = !attachment && attachmentsLoaded();
          dom.classList.toggle('attachment-ref--missing', missing);
          dom.textContent = `📎 ${attachment ? attachment.name : missing ? this.options.missingLabel() : '…'}`;
          dom.title = attachment ? this.options.titleFor(attachment.name) : '';
          dom.setAttribute('role', attachment ? 'button' : 'img');
        });
        return disposeRoot;
      });

      const handleClick = (event: MouseEvent) => {
        if (id === null || !entryAttachments().some((a) => a.id === id)) return;
        event.preventDefault();
        requestSaveAttachmentCopy(id);
      };
      dom.addEventListener('click', handleClick);

      return {
        dom,
        // Atom: ProseMirror must not try to reconcile our DOM content.
        ignoreMutation: () => true,
        destroy: () => {
          dom.removeEventListener('click', handleClick);
          dispose();
        },
      };
    };
  },
});
