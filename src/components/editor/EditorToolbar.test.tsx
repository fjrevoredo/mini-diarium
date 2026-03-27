import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import EditorToolbar from './EditorToolbar';
import { setPreferences } from '../../state/preferences';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Minimal Editor mock — TipTap cannot run in jsdom
// ---------------------------------------------------------------------------

function makeEditorMock(
  overrides: {
    isActive?: (
      nameOrAttrs: string | Record<string, unknown>,
      attrs?: Record<string, unknown>,
    ) => boolean;
  } = {},
): Editor {
  const isActive =
    overrides.isActive ??
    ((_nameOrAttrs: string | Record<string, unknown>, _attrs?: Record<string, unknown>) => false);

  const run = vi.fn();
  const setTextAlign = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({
    setTextAlign,
    toggleBold: vi.fn(() => ({ run })),
    toggleItalic: vi.fn(() => ({ run })),
  }));
  const chain = vi.fn(() => ({ focus }));

  return {
    isActive,
    chain,
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  } as unknown as Editor;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset to default preferences before each test
  setPreferences({
    advancedToolbar: false,
    allowFutureEntries: false,
    firstDayOfWeek: null,
    hideTitles: false,
    enableSpellcheck: true,
    escAction: 'none',
    autoLockEnabled: false,
    autoLockTimeout: 300,
    editorFontSize: 16,
    showEntryTimestamps: false,
  });
});

// ---------------------------------------------------------------------------
// Alignment buttons — visibility
// ---------------------------------------------------------------------------

describe('EditorToolbar alignment buttons — visibility', () => {
  it('hides alignment buttons when advancedToolbar is false', () => {
    setPreferences({ advancedToolbar: false });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    expect(container.querySelector('[aria-label="Align left"]')).toBeNull();
    expect(container.querySelector('[aria-label="Align center"]')).toBeNull();
    expect(container.querySelector('[aria-label="Align right"]')).toBeNull();
    expect(container.querySelector('[aria-label="Justify"]')).toBeNull();
  });

  it('shows all four alignment buttons when advancedToolbar is true', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    expect(container.querySelector('[aria-label="Align left"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Align center"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Align right"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Justify"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Alignment buttons — active state
// ---------------------------------------------------------------------------

describe('EditorToolbar alignment buttons — active state', () => {
  it('marks Align left as active by default (no textAlign attribute)', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      isActive: () => false,
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    const leftBtn = container.querySelector('[aria-label="Align left"]') as HTMLButtonElement;
    expect(leftBtn).not.toBeNull();
    // Active class contains 'btn-active'; inactive class contains 'text-secondary'
    expect(leftBtn.className).toContain('btn-active');
  });

  it('marks Align center as active when textAlign center is active', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      isActive: (nameOrAttrs) => {
        if (typeof nameOrAttrs === 'object' && nameOrAttrs.textAlign === 'center') return true;
        return false;
      },
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    const centerBtn = container.querySelector('[aria-label="Align center"]') as HTMLButtonElement;
    expect(centerBtn.className).toContain('btn-active');

    const leftBtn = container.querySelector('[aria-label="Align left"]') as HTMLButtonElement;
    expect(leftBtn.className).not.toContain('btn-active');
  });

  it('marks Align right as active when textAlign right is active', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      isActive: (nameOrAttrs) => {
        if (typeof nameOrAttrs === 'object' && nameOrAttrs.textAlign === 'right') return true;
        return false;
      },
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    const rightBtn = container.querySelector('[aria-label="Align right"]') as HTMLButtonElement;
    expect(rightBtn.className).toContain('btn-active');
  });

  it('marks Justify as active when textAlign justify is active', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      isActive: (nameOrAttrs) => {
        if (typeof nameOrAttrs === 'object' && nameOrAttrs.textAlign === 'justify') return true;
        return false;
      },
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    const justifyBtn = container.querySelector('[aria-label="Justify"]') as HTMLButtonElement;
    expect(justifyBtn.className).toContain('btn-active');
  });
});

// ---------------------------------------------------------------------------
// Alignment buttons — click behaviour
// ---------------------------------------------------------------------------

describe('EditorToolbar alignment buttons — click behaviour', () => {
  it('calls setTextAlign("left") when Align left is clicked', () => {
    setPreferences({ advancedToolbar: true });
    const run = vi.fn();
    const setTextAlign = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ setTextAlign }));
    const chain = vi.fn(() => ({ focus }));
    const editor = makeEditorMock();
    (editor as unknown as { chain: typeof chain }).chain = chain;

    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const leftBtn = container.querySelector('[aria-label="Align left"]') as HTMLButtonElement;
    fireEvent.click(leftBtn);

    expect(setTextAlign).toHaveBeenCalledWith('left');
    expect(run).toHaveBeenCalled();
  });

  it('calls setTextAlign("center") when Align center is clicked', () => {
    setPreferences({ advancedToolbar: true });
    const run = vi.fn();
    const setTextAlign = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ setTextAlign }));
    const chain = vi.fn(() => ({ focus }));
    const editor = makeEditorMock();
    (editor as unknown as { chain: typeof chain }).chain = chain;

    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const centerBtn = container.querySelector('[aria-label="Align center"]') as HTMLButtonElement;
    fireEvent.click(centerBtn);

    expect(setTextAlign).toHaveBeenCalledWith('center');
    expect(run).toHaveBeenCalled();
  });

  it('calls setTextAlign("right") when Align right is clicked', () => {
    setPreferences({ advancedToolbar: true });
    const run = vi.fn();
    const setTextAlign = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ setTextAlign }));
    const chain = vi.fn(() => ({ focus }));
    const editor = makeEditorMock();
    (editor as unknown as { chain: typeof chain }).chain = chain;

    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const rightBtn = container.querySelector('[aria-label="Align right"]') as HTMLButtonElement;
    fireEvent.click(rightBtn);

    expect(setTextAlign).toHaveBeenCalledWith('right');
    expect(run).toHaveBeenCalled();
  });

  it('calls setTextAlign("justify") when Justify is clicked', () => {
    setPreferences({ advancedToolbar: true });
    const run = vi.fn();
    const setTextAlign = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ setTextAlign }));
    const chain = vi.fn(() => ({ focus }));
    const editor = makeEditorMock();
    (editor as unknown as { chain: typeof chain }).chain = chain;

    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const justifyBtn = container.querySelector('[aria-label="Justify"]') as HTMLButtonElement;
    fireEvent.click(justifyBtn);

    expect(setTextAlign).toHaveBeenCalledWith('justify');
    expect(run).toHaveBeenCalled();
  });
});
