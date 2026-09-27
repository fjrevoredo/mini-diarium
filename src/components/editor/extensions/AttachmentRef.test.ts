import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { AttachmentRef, parseAttachmentRefId } from './AttachmentRef';
import {
  loadEntryAttachments,
  registerSaveCopyHandler,
  resetEntryAttachmentsState,
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
