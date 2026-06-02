import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import LinkOverlay from './LinkOverlay';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Editor mock — TipTap cannot run in jsdom. We build a minimal shape covering
// the API surface LinkOverlay calls:
//   - isActive('link')  → boolean
//   - getAttributes('link') → { href?: string }
//   - state.selection.{from,to} → number
//   - state.doc.textBetween(from, to, sep, sep) → string
//   - chain().focus().{deleteSelection,insertContent,setLink,extendMarkRange,
//                    unsetLink}().run()
// ---------------------------------------------------------------------------

interface MockEditorOverrides {
  isLinkActive?: boolean;
  linkHref?: string;
  selectionFrom?: number;
  selectionTo?: number;
  selectionText?: string;
}

interface MockEditorHandle {
  editor: Editor;
  deleteSelection: ReturnType<typeof vi.fn>;
  insertContent: ReturnType<typeof vi.fn>;
  setLink: ReturnType<typeof vi.fn>;
  unsetLink: ReturnType<typeof vi.fn>;
  extendMarkRange: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function makeEditorMock(overrides: MockEditorOverrides = {}): MockEditorHandle {
  const linkHref = overrides.linkHref ?? '';
  const isLinkActive = overrides.isLinkActive ?? false;
  const selectionFrom = overrides.selectionFrom ?? 0;
  const selectionTo = overrides.selectionTo ?? 0;
  const selectionText = overrides.selectionText ?? '';

  // Fully chainable builder: every method returns the builder itself so the
  // pattern `chain().focus().deleteSelection().insertContent(...).run()` works.
  const run = vi.fn();
  const builder: {
    focus: ReturnType<typeof vi.fn>;
    deleteSelection: ReturnType<typeof vi.fn>;
    insertContent: ReturnType<typeof vi.fn>;
    extendMarkRange: ReturnType<typeof vi.fn>;
    setLink: ReturnType<typeof vi.fn>;
    unsetLink: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  } = {
    focus: vi.fn(function (this: unknown) {
      return this;
    }),
    deleteSelection: vi.fn(function (this: unknown) {
      return this;
    }),
    insertContent: vi.fn(function (this: unknown) {
      return this;
    }),
    extendMarkRange: vi.fn(function (this: unknown) {
      return this;
    }),
    setLink: vi.fn(function (this: unknown) {
      return this;
    }),
    unsetLink: vi.fn(function (this: unknown) {
      return this;
    }),
    run,
  };
  const chain = vi.fn(() => builder);

  const editor = {
    isActive: (name: string) => name === 'link' && isLinkActive,
    getAttributes: (name: string) => (name === 'link' ? { href: linkHref } : {}),
    state: {
      selection: { from: selectionFrom, to: selectionTo },
      doc: {
        textBetween: (_from: number, _to: number, _blockSep: string, _leafSep: string) =>
          selectionText,
      },
    },
    chain,
  } as unknown as Editor;

  return {
    editor,
    deleteSelection: builder.deleteSelection,
    insertContent: builder.insertContent,
    setLink: builder.setLink,
    unsetLink: builder.unsetLink,
    extendMarkRange: builder.extendMarkRange,
    focus: builder.focus,
    run,
  };
}

describe('LinkOverlay — rendering', () => {
  it('renders nothing when isOpen is false', () => {
    const { editor } = makeEditorMock();
    const { container } = renderWithI18n(() => (
      <LinkOverlay editor={editor} isOpen={false} onClose={() => {}} />
    ));
    expect(container.querySelector('[data-testid="link-url-input"]')).toBeNull();
  });

  it('renders URL and Label inputs and an Insert button in insert mode (no selection, no active link)', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-url-input"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="link-label-input"]')).not.toBeNull();
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.textContent).toBe('Insert');
  });

  it('renders Apply button in wrap-selection mode (non-empty selection, no active link) with label pre-filled with selected text', () => {
    const { editor } = makeEditorMock({
      selectionFrom: 0,
      selectionTo: 5,
      selectionText: 'Hello',
    });
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const label = document.querySelector('[data-testid="link-label-input"]') as HTMLInputElement;
    expect(label.value).toBe('Hello');
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.textContent).toBe('Apply');
  });

  it('renders Update button in edit mode (cursor on existing link) with URL and label pre-filled', () => {
    const { editor } = makeEditorMock({
      isLinkActive: true,
      linkHref: 'https://existing.com',
      selectionFrom: 0,
      selectionTo: 5,
      selectionText: 'Existing',
    });
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    const label = document.querySelector('[data-testid="link-label-input"]') as HTMLInputElement;
    expect(url.value).toBe('https://existing.com');
    expect(label.value).toBe('Existing');
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.textContent).toBe('Update');
  });

  it('renders Remove link button only in edit mode', () => {
    const { editor: editEditor } = makeEditorMock({
      isLinkActive: true,
      linkHref: 'https://a.com',
    });
    const { unmount } = renderWithI18n(() => (
      <LinkOverlay editor={editEditor} isOpen={true} onClose={() => {}} />
    ));
    expect(document.querySelector('[data-testid="link-remove-button"]')).not.toBeNull();
    unmount();

    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-remove-button"]')).toBeNull();
  });

  it('does NOT render Remove link button in wrap-selection mode', () => {
    const { editor } = makeEditorMock({ selectionFrom: 0, selectionTo: 5 });
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-remove-button"]')).toBeNull();
  });

  it('captures the mode ONCE at open time (selection changes after open do not switch modes)', () => {
    // This is the bug we just fixed: previously, if the editor lost focus
    // after the dialog opened, mode would silently flip to "insert" and the
    // user would lose their selection-wrapping intent. The mode is now a
    // signal that is set once.
    const handle = makeEditorMock({
      selectionFrom: 0,
      selectionTo: 5,
      selectionText: 'Hello',
    });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={() => {}} />);
    // The dialog opens in wrap-selection mode, with label = "Hello"
    const label = document.querySelector('[data-testid="link-label-input"]') as HTMLInputElement;
    expect(label.value).toBe('Hello');

    // Simulate the user typing a URL
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://example.com' } });

    // Now imagine the editor's selection collapsed (focus loss). The mode
    // should still be wrap-selection, so the apply path uses
    // deleteSelection + insertContent on the captured range.
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.deleteSelection).toHaveBeenCalled();
    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'Hello', // falls back to selection text since label is empty
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
  });
});

describe('LinkOverlay — confirm behavior', () => {
  it('inserts new text with the link mark on confirm in insert mode (no selection)', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'https://example.com', // label empty → URL is used as the visible text
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
    expect(handle.deleteSelection).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('inserts new text with a custom label on confirm in insert mode', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://example.com' } });
    const label = document.querySelector('[data-testid="link-label-input"]') as HTMLInputElement;
    fireEvent.input(label, { target: { value: 'Example' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'Example',
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
  });

  it('wraps selected text with the link mark on confirm in wrap-selection mode', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({
      selectionFrom: 0,
      selectionTo: 5,
      selectionText: 'Hello',
    });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    // Wrap mode: the selection is replaced with the label text + link mark.
    expect(handle.deleteSelection).toHaveBeenCalled();
    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'Hello', // label defaulted to the selected text
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('wraps with a custom label in wrap-selection mode', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({
      selectionFrom: 0,
      selectionTo: 5,
      selectionText: 'Hello',
    });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://example.com' } });
    const label = document.querySelector('[data-testid="link-label-input"]') as HTMLInputElement;
    fireEvent.input(label, { target: { value: 'Greetings' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'Greetings',
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
  });

  it("replaces the link's text and href atomically on confirm in edit mode", () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({
      isLinkActive: true,
      linkHref: 'https://old.com',
      selectionFrom: 0,
      selectionTo: 5,
      selectionText: 'Old label',
    });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://new.com' } });
    const label = document.querySelector('[data-testid="link-label-input"]') as HTMLInputElement;
    fireEvent.input(label, { target: { value: 'New label' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    // Edit mode: extendMarkRange covers the entire link, then delete + insert.
    expect(handle.extendMarkRange).toHaveBeenCalledWith('link');
    expect(handle.deleteSelection).toHaveBeenCalled();
    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'New label',
      marks: [{ type: 'link', attrs: { href: 'https://new.com' } }],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls extendMarkRange + unsetLink on Remove click', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({
      isLinkActive: true,
      linkHref: 'https://a.com',
    });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const removeBtn = document.querySelector(
      '[data-testid="link-remove-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(removeBtn);

    expect(handle.extendMarkRange).toHaveBeenCalledWith('link');
    expect(handle.unsetLink).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('LinkOverlay — URL normalization', () => {
  it('accepts a bare domain and auto-prefixes https://', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'example.com',
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
  });

  it('accepts an email and prefixes mailto:', () => {
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'user@example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'user@example.com',
      marks: [{ type: 'link', attrs: { href: 'mailto:user@example.com' } }],
    });
  });

  it('accepts a phone number and prefixes tel:', () => {
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: '+1 234 567 8901' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: '+1 234 567 8901',
      marks: [{ type: 'link', attrs: { href: 'tel:+12345678901' } }],
    });
  });

  it('preserves an existing https:// protocol', () => {
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'https://example.com/path' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'https://example.com/path',
      marks: [{ type: 'link', attrs: { href: 'https://example.com/path' } }],
    });
  });

  it('rejects javascript: URLs (security)', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'javascript:alert(1)' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);

    expect(handle.insertContent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects data: URLs (security)', () => {
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'data:text/html,<script>alert(1)</script>' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });
});

describe('LinkOverlay — Open link button', () => {
  it('does not render the Open link button when the URL is empty or invalid', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-open-button"]')).toBeNull();
  });

  it('renders the Open link button when the URL is a valid bare domain', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'example.com' } });
    expect(document.querySelector('[data-testid="link-open-button"]')).not.toBeNull();
  });
});

describe('LinkOverlay — validation', () => {
  it('disables the confirm button when URL is empty', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('enables the confirm button for a bare domain like example.com', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const url = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(url, { target: { value: 'example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
  });
});

describe('LinkOverlay — close behavior', () => {
  it('closes when Escape is pressed inside the dialog', () => {
    const onClose = vi.fn();
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={onClose} />);

    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the Cancel button is clicked', () => {
    const onClose = vi.fn();
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={onClose} />);

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel',
    ) as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
