import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import LinkOverlay from './LinkOverlay';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Editor mock — TipTap cannot run in jsdom. We build a minimal shape covering
// the API surface LinkOverlay calls: isActive('link'), getAttributes('link'),
// state.selection.{from,to}, and chain().focus().{extendMarkRange,setLink,
// unsetLink,insertContent}().run().
// ---------------------------------------------------------------------------

interface MockEditorOverrides {
  isLinkActive?: boolean;
  linkHref?: string;
  selectionFrom?: number;
  selectionTo?: number;
}

interface MockEditorHandle {
  editor: Editor;
  setLink: ReturnType<typeof vi.fn>;
  unsetLink: ReturnType<typeof vi.fn>;
  insertContent: ReturnType<typeof vi.fn>;
  extendMarkRange: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function makeEditorMock(overrides: MockEditorOverrides = {}): MockEditorHandle {
  const linkHref = overrides.linkHref ?? '';
  const isLinkActive = overrides.isLinkActive ?? false;
  const selectionFrom = overrides.selectionFrom ?? 0;
  const selectionTo = overrides.selectionTo ?? 0;

  const run = vi.fn();
  const setLink = vi.fn(() => ({ run }));
  const unsetLink = vi.fn(() => ({ run }));
  const insertContent = vi.fn(() => ({ run }));
  const extendMarkRange = vi.fn(() => ({ setLink, unsetLink, run }));
  const focus = vi.fn(() => ({
    extendMarkRange,
    setLink,
    unsetLink,
    insertContent,
    run,
  }));
  const chain = vi.fn(() => ({ focus }));

  const editor = {
    isActive: (name: string) => name === 'link' && isLinkActive,
    getAttributes: (name: string) => (name === 'link' ? { href: linkHref } : {}),
    state: { selection: { from: selectionFrom, to: selectionTo } },
    chain,
  } as unknown as Editor;

  return { editor, setLink, unsetLink, insertContent, extendMarkRange, focus, run };
}

describe('LinkOverlay — rendering', () => {
  it('renders nothing when isOpen is false', () => {
    const { editor } = makeEditorMock();
    const { container } = renderWithI18n(() => (
      <LinkOverlay editor={editor} isOpen={false} onClose={() => {}} />
    ));
    // Kobalte Dialog renders its content lazily; closed dialog has no inputs.
    expect(container.querySelector('[data-testid="link-url-input"]')).toBeNull();
  });

  it('renders URL input and Insert button in insert mode (no selection, no active link)', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-url-input"]')).not.toBeNull();
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.textContent).toBe('Insert');
  });

  it('renders Apply button in wrap-selection mode (non-empty selection, no active link)', () => {
    const { editor } = makeEditorMock({ selectionFrom: 0, selectionTo: 5 });
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.textContent).toBe('Apply');
  });

  it('renders Update button and pre-filled URL in edit mode (cursor on existing link)', () => {
    const { editor } = makeEditorMock({
      isLinkActive: true,
      linkHref: 'https://existing.com',
    });
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    expect(input.value).toBe('https://existing.com');
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
    renderWithI18n(() => <LinkOverlay editor={editEditor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-remove-button"]')).not.toBeNull();
  });

  it('does NOT render Remove link button in insert mode', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-remove-button"]')).toBeNull();
  });

  it('does NOT render Remove link button in wrap-selection mode', () => {
    const { editor } = makeEditorMock({ selectionFrom: 0, selectionTo: 5 });
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="link-remove-button"]')).toBeNull();
  });
});

describe('LinkOverlay — confirm behavior', () => {
  it('calls insertContent with link mark on confirm in insert mode', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'https://example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'https://example.com',
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    });
    expect(handle.run).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls extendMarkRange + setLink on confirm in wrap-selection mode', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({ selectionFrom: 0, selectionTo: 5 });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'https://example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.extendMarkRange).toHaveBeenCalledWith('link');
    expect(handle.setLink).toHaveBeenCalledWith({ href: 'https://example.com' });
    expect(handle.insertContent).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls extendMarkRange + setLink on confirm in edit mode', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({ isLinkActive: true, linkHref: 'https://old.com' });
    renderWithI18n(() => <LinkOverlay editor={handle.editor} isOpen={true} onClose={onClose} />);

    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'https://new.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    fireEvent.click(confirm);

    expect(handle.extendMarkRange).toHaveBeenCalledWith('link');
    expect(handle.setLink).toHaveBeenCalledWith({ href: 'https://new.com' });
    expect(handle.insertContent).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls extendMarkRange + unsetLink on Remove click', () => {
    const onClose = vi.fn();
    const handle = makeEditorMock({ isLinkActive: true, linkHref: 'https://a.com' });
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

describe('LinkOverlay — URL validation', () => {
  it('disables the confirm button when URL is empty', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('disables the confirm button for an unsupported scheme', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'javascript:alert(1)' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('enables the confirm button for https URLs', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'https://example.com' } });
    const confirm = document.querySelector(
      '[data-testid="link-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
  });

  it('enables the confirm button for mailto: URLs', () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <LinkOverlay editor={editor} isOpen={true} onClose={() => {}} />);
    const input = document.querySelector('[data-testid="link-url-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'mailto:user@example.com' } });
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

    // Cancel button is identifiable by its text in the dialog footer
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel',
    ) as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
