import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { AttachmentRef, parseAttachmentRefId } from './AttachmentRef';
import {
  loadEntryAttachments,
  registerSaveCopyHandler,
  removeEntryAttachmentFromList,
  resetEntryAttachmentsState,
  upsertEntryAttachment,
} from '../../../state/entryAttachments';
import type { AttachmentSummary } from '../../../lib/tauri';

const mocks = vi.hoisted(() => ({ listEntryAttachments: vi.fn() }));
vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return { ...actual, listEntryAttachments: mocks.listEntryAttachments };
});

const PDF: AttachmentSummary = {
  id: 3,
  name: 'Report.pdf',
  mime_type: 'application/pdf',
  byte_size: 10,
  created_at: '2024-01-01T00:00:00Z',
};

let editor: Editor | null = null;

function makeEditor(content: string, editable = true): Editor {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, AttachmentRef.configure({ missingLabel: () => 'Missing' })],
    content,
    editable,
  });
  return editor;
}

describe('AttachmentRef', () => {
  beforeEach(() => {
    resetEntryAttachmentsState();
    mocks.listEntryAttachments.mockResolvedValue([PDF]);
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it('round-trips as an id-only span', () => {
    const html = '<p>See <span data-attachment-ref="3"></span> here</p>';
    expect(makeEditor(html).getHTML()).toBe(html);
  });

  it('drops a ref span whose id is not a positive integer', () => {
    const ed = makeEditor('<p>a<span data-attachment-ref="x"></span>b</p>');
    expect(ed.getHTML()).not.toContain('data-attachment-ref');
  });

  it('contributes no text, so word count and the empty check ignore it', () => {
    const ed = makeEditor('<p><span data-attachment-ref="3"></span></p>');
    expect(ed.getText().trim()).toBe('');
  });

  it('insertAttachmentRef inserts a ref when editable', () => {
    const ed = makeEditor('<p>x</p>');
    expect(ed.commands.insertAttachmentRef(3)).toBe(true);
    expect(ed.getHTML()).toContain('<span data-attachment-ref="3"></span>');
  });

  it('insertAttachmentRef is a no-op on a read-only (locked) editor', () => {
    const ed = makeEditor('<p>x</p>', false);
    expect(ed.commands.insertAttachmentRef(3)).toBe(false);
    expect(ed.getHTML()).not.toContain('data-attachment-ref');
  });

  it('renders the name once loaded, and "missing" for an unknown id', async () => {
    const ed = makeEditor(
      '<p><span data-attachment-ref="3"></span><span data-attachment-ref="9"></span></p>',
    );
    await loadEntryAttachments(1);
    const refs = ed.view.dom.querySelectorAll('.attachment-ref');
    expect(refs[0].textContent).toBe('📎 Report.pdf');
    expect(refs[0].classList.contains('attachment-ref--missing')).toBe(false);
    expect(refs[1].textContent).toBe('📎 Missing');
    expect(refs[1].classList.contains('attachment-ref--missing')).toBe(true);
  });

  it('does not flag a ref as missing while the list is still loading', () => {
    const ed = makeEditor('<p><span data-attachment-ref="9"></span></p>');
    const ref = ed.view.dom.querySelector('.attachment-ref')!;
    expect(ref.classList.contains('attachment-ref--missing')).toBe(false);
  });

  it('forwards a click on a resolved ref to the save-copy handler', async () => {
    const ed = makeEditor('<p><span data-attachment-ref="3"></span></p>');
    await loadEntryAttachments(1);
    const handler = vi.fn();
    const unregister = registerSaveCopyHandler(handler);
    (ed.view.dom.querySelector('.attachment-ref') as HTMLElement).click();
    expect(handler).toHaveBeenCalledWith(3);
    unregister();
  });
});

describe('AttachmentRef keyboard access', () => {
  let host: HTMLElement | null = null;
  let documentKeydown: Mock<(event: KeyboardEvent) => void>;
  let saveHandler: Mock<(attachmentId: number) => void>;
  let unregisterSave: () => void = () => {};

  // Attached to the document: a detached element cannot take focus.
  function makeMountedEditor(content: string, editable = true): Editor {
    host = document.createElement('div');
    document.body.appendChild(host);
    editor = new Editor({
      element: host,
      extensions: [
        StarterKit,
        AttachmentRef.configure({
          missingLabel: () => 'Missing',
          ariaLabelFor: (name) => `Save ${name}`,
          loadingLabel: () => 'Loading',
        }),
      ],
      content,
      editable,
    });
    return editor;
  }

  function refAt(ed: Editor, index = 0): HTMLElement {
    return ed.view.dom.querySelectorAll<HTMLElement>('.attachment-ref')[index];
  }

  function press(el: HTMLElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    resetEntryAttachmentsState();
    mocks.listEntryAttachments.mockResolvedValue([PDF]);
    // Stands in for the global shortcut handler, which listens on `document`.
    documentKeydown = vi.fn<(event: KeyboardEvent) => void>();
    document.addEventListener('keydown', documentKeydown);
    saveHandler = vi.fn<(attachmentId: number) => void>();
    unregisterSave = registerSaveCopyHandler(saveHandler);
  });

  afterEach(() => {
    document.removeEventListener('keydown', documentKeydown);
    unregisterSave();
    editor?.destroy();
    editor = null;
    host?.remove();
    host = null;
  });

  it('makes a resolved ref a focusable, named button', async () => {
    const ed = makeMountedEditor('<p>a<span data-attachment-ref="3"></span>b</p>');
    await loadEntryAttachments(1);
    const ref = refAt(ed);
    expect(ref.getAttribute('role')).toBe('button');
    expect(ref.getAttribute('tabindex')).toBe('0');
    expect(ref.getAttribute('aria-label')).toBe('Save Report.pdf');
    ref.focus();
    expect(document.activeElement).toBe(ref);
  });

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
  ])('%s on a focused resolved ref saves a copy and stops at the ref', async (_label, key) => {
    const html = '<p>a<span data-attachment-ref="3"></span>b</p>';
    const ed = makeMountedEditor(html);
    await loadEntryAttachments(1);
    const ref = refAt(ed);
    ref.focus();

    const event = press(ref, key);

    expect(saveHandler).toHaveBeenCalledExactlyOnceWith(3);
    expect(event.defaultPrevented).toBe(true);
    expect(documentKeydown).not.toHaveBeenCalled();
    expect(ed.getHTML()).toBe(html);
  });

  it('saves a copy from the keyboard on a read-only (locked) editor', async () => {
    const ed = makeMountedEditor('<p><span data-attachment-ref="3"></span></p>', false);
    await loadEntryAttachments(1);
    const ref = refAt(ed);
    ref.focus();
    expect(document.activeElement).toBe(ref);

    press(ref, 'Enter');
    press(ref, ' ');

    expect(saveHandler).toHaveBeenCalledTimes(2);
    expect(saveHandler).toHaveBeenCalledWith(3);
  });

  it('opens one save request when a held key auto-repeats', async () => {
    const ed = makeMountedEditor('<p><span data-attachment-ref="3"></span></p>');
    await loadEntryAttachments(1);
    const ref = refAt(ed);
    const repeat = new KeyboardEvent('keydown', {
      key: 'Enter',
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    ref.dispatchEvent(repeat);
    expect(saveHandler).not.toHaveBeenCalled();
    expect(repeat.defaultPrevented).toBe(true);
    expect(documentKeydown).not.toHaveBeenCalled();
  });

  it('leaves a missing ref non-interactive: no tab stop, image role, keys pass through', async () => {
    const ed = makeMountedEditor('<p><span data-attachment-ref="9"></span></p>');
    await loadEntryAttachments(1);
    const ref = refAt(ed);
    expect(ref.getAttribute('role')).toBe('img');
    expect(ref.hasAttribute('tabindex')).toBe(false);
    expect(ref.getAttribute('aria-label')).toBe('Missing');

    press(ref, 'Enter');

    expect(saveHandler).not.toHaveBeenCalled();
    expect(documentKeydown).toHaveBeenCalledTimes(1);
  });

  it('names a ref as loading, without a tab stop, until the list arrives', () => {
    const ed = makeMountedEditor('<p><span data-attachment-ref="3"></span></p>');
    const ref = refAt(ed);
    expect(ref.getAttribute('role')).toBe('img');
    expect(ref.hasAttribute('tabindex')).toBe(false);
    expect(ref.getAttribute('aria-label')).toBe('Loading');
  });

  it('adds and removes the tab stop as the ref flips between resolved and missing', async () => {
    const ed = makeMountedEditor('<p><span data-attachment-ref="3"></span></p>');
    await loadEntryAttachments(1);
    const ref = refAt(ed);
    expect(ref.getAttribute('tabindex')).toBe('0');

    removeEntryAttachmentFromList(1, 3);
    expect(ref.getAttribute('role')).toBe('img');
    expect(ref.hasAttribute('tabindex')).toBe(false);
    expect(ref.getAttribute('aria-label')).toBe('Missing');

    upsertEntryAttachment(1, PDF);
    expect(refAt(ed)).toBe(ref);
    expect(ref.getAttribute('role')).toBe('button');
    expect(ref.getAttribute('tabindex')).toBe('0');
    expect(ref.getAttribute('aria-label')).toBe('Save Report.pdf');
    // Becoming resolved again does not pull focus onto the ref.
    expect(document.activeElement).not.toBe(ref);
    press(ref, ' ');
    expect(saveHandler).toHaveBeenCalledExactlyOnceWith(3);
  });

  // A focused ref that stops resolving must not keep focus: a key on it would reach
  // ProseMirror and edit the entry at the editor's old selection.
  async function focusResolvedRef(html: string): Promise<{ ed: Editor; ref: HTMLElement }> {
    const ed = makeMountedEditor(html);
    await loadEntryAttachments(1);
    // A caret inside "ab", where a stray Enter would split the paragraph.
    ed.commands.setTextSelection(2);
    const ref = refAt(ed);
    ref.focus();
    expect(document.activeElement).toBe(ref);
    return { ed, ref };
  }

  function pressOnActiveElement(key: string): void {
    press((document.activeElement ?? document.body) as HTMLElement, key);
  }

  it('releases focus when a focused ref becomes missing, so later keys do not edit the entry', async () => {
    const html = '<p>ab<span data-attachment-ref="3"></span></p>';
    const { ed, ref } = await focusResolvedRef(html);

    removeEntryAttachmentFromList(1, 3);

    expect(ref.getAttribute('role')).toBe('img');
    expect(document.activeElement).not.toBe(ref);
    expect(ed.view.dom.contains(document.activeElement)).toBe(false);
    pressOnActiveElement('Enter');
    pressOnActiveElement(' ');
    expect(ed.getHTML()).toBe(html);
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('releases focus when a focused ref goes back to loading, so later keys do not edit the entry', async () => {
    const html = '<p>ab<span data-attachment-ref="3"></span></p>';
    const { ed, ref } = await focusResolvedRef(html);
    let finishReload: (list: AttachmentSummary[]) => void = () => {};
    mocks.listEntryAttachments.mockReturnValueOnce(
      new Promise<AttachmentSummary[]>((resolve) => {
        finishReload = resolve;
      }),
    );

    const reload = loadEntryAttachments(1);

    expect(ref.getAttribute('aria-label')).toBe('Loading');
    expect(ref.hasAttribute('tabindex')).toBe(false);
    expect(document.activeElement).not.toBe(ref);
    expect(ed.view.dom.contains(document.activeElement)).toBe(false);
    pressOnActiveElement('Enter');
    pressOnActiveElement(' ');
    expect(ed.getHTML()).toBe(html);
    expect(saveHandler).not.toHaveBeenCalled();

    finishReload([PDF]);
    await reload;
  });

  it('does not take focus from another element when a ref stops resolving', async () => {
    const ed = makeMountedEditor('<p><span data-attachment-ref="3"></span></p>');
    await loadEntryAttachments(1);
    const other = document.createElement('button');
    document.body.appendChild(other);
    try {
      other.focus();
      expect(document.activeElement).toBe(other);

      removeEntryAttachmentFromList(1, 3);

      expect(refAt(ed).getAttribute('role')).toBe('img');
      expect(document.activeElement).toBe(other);
    } finally {
      other.remove();
    }
  });
});

describe('parseAttachmentRefId', () => {
  it('accepts positive integers only', () => {
    expect(parseAttachmentRefId('12')).toBe(12);
    expect(parseAttachmentRefId(' 7 ')).toBe(7);
    expect(parseAttachmentRefId('0')).toBeNull();
    expect(parseAttachmentRefId('-1')).toBeNull();
    expect(parseAttachmentRefId('1.5')).toBeNull();
    expect(parseAttachmentRefId(null)).toBeNull();
  });
});
