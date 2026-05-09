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
    getAttributes?: (name: string) => Record<string, unknown>;
  } = {},
): Editor {
  const isActive =
    overrides.isActive ??
    ((_nameOrAttrs: string | Record<string, unknown>, _attrs?: Record<string, unknown>) => false);
  const getAttributes = overrides.getAttributes ?? ((_name: string) => ({}));

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
    getAttributes,
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
// Underline button — always visible
// ---------------------------------------------------------------------------

describe('EditorToolbar underline button — visibility', () => {
  it('shows underline button when advancedToolbar is false', () => {
    setPreferences({ advancedToolbar: false });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Underline (Ctrl/Cmd+U)"]')).not.toBeNull();
  });

  it('shows underline button when advancedToolbar is true', () => {
    setPreferences({ advancedToolbar: true });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Underline (Ctrl/Cmd+U)"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Color buttons — visibility
// ---------------------------------------------------------------------------

describe('EditorToolbar color buttons — visibility', () => {
  it('hides text color and highlight color buttons when advancedToolbar is false', () => {
    setPreferences({ advancedToolbar: false });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Text color"]')).toBeNull();
    expect(container.querySelector('[aria-label="Highlight color"]')).toBeNull();
  });

  it('shows text color and highlight color buttons when advancedToolbar is true', () => {
    setPreferences({ advancedToolbar: true });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Text color"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Highlight color"]')).not.toBeNull();
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

  it('marks Align right as active for RTL paragraph with no explicit textAlign', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      isActive: () => false,
      getAttributes: (name) => (name === 'paragraph' ? { dir: 'rtl' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    const rightBtn = container.querySelector('[aria-label="Align right"]') as HTMLButtonElement;
    expect(rightBtn.className).toContain('btn-active');
    const leftBtn = container.querySelector('[aria-label="Align left"]') as HTMLButtonElement;
    expect(leftBtn.className).not.toContain('btn-active');
  });

  it('marks Align left as active when explicit text-align:left overrides dir=rtl', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      isActive: (nameOrAttrs) =>
        typeof nameOrAttrs === 'object' && nameOrAttrs.textAlign === 'left',
      getAttributes: (name) => (name === 'paragraph' ? { dir: 'rtl' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    const leftBtn = container.querySelector('[aria-label="Align left"]') as HTMLButtonElement;
    expect(leftBtn.className).toContain('btn-active');
    const rightBtn = container.querySelector('[aria-label="Align right"]') as HTMLButtonElement;
    expect(rightBtn.className).not.toContain('btn-active');
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

// ---------------------------------------------------------------------------
// Import Markdown button — visibility and callback
// ---------------------------------------------------------------------------

describe('EditorToolbar import markdown button', () => {
  it('hides the import markdown button when advancedToolbar is false', () => {
    setPreferences({ advancedToolbar: false });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Import Markdown file"]')).toBeNull();
  });

  it('shows the import markdown button when advancedToolbar is true', () => {
    setPreferences({ advancedToolbar: true });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Import Markdown file"]')).not.toBeNull();
  });

  it('calls onImportMarkdown when the button is clicked', () => {
    setPreferences({ advancedToolbar: true });
    const onImportMarkdown = vi.fn();
    const { container } = renderWithI18n(() => (
      <EditorToolbar editor={makeEditorMock()} onImportMarkdown={onImportMarkdown} />
    ));
    const btn = container.querySelector('[aria-label="Import Markdown file"]') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onImportMarkdown).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Insert Timestamp button — visibility
// ---------------------------------------------------------------------------

describe('EditorToolbar insert timestamp button — visibility', () => {
  it('hides the insert timestamp button when advancedToolbar is false', () => {
    setPreferences({ advancedToolbar: false });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Insert timestamp"]')).toBeNull();
  });

  it('shows the insert timestamp button when advancedToolbar is true', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Insert timestamp"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Text direction button
// ---------------------------------------------------------------------------

describe('Text direction button', () => {
  it('hides the text direction button when advancedToolbar is false', () => {
    setPreferences({ advancedToolbar: false });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Text direction"]')).toBeNull();
  });

  it('shows the text direction button when advancedToolbar is true', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Text direction"]')).not.toBeNull();
  });

  it('marks the button as active for RTL paragraph', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      getAttributes: (name) => (name === 'paragraph' ? { dir: 'rtl' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    expect(btn.className).toContain('btn-active');
  });

  it('does not mark the button as active for LTR paragraph', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      getAttributes: (name) => (name === 'paragraph' ? { dir: 'ltr' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    expect(btn.className).not.toContain('btn-active');
  });

  it('does not mark the button as active when dir is absent', () => {
    setPreferences({ advancedToolbar: true });
    const editor = makeEditorMock({
      getAttributes: () => ({}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    expect(btn.className).not.toContain('btn-active');
  });

  it('calls setTextDirection("rtl") when clicked on LTR paragraph', () => {
    setPreferences({ advancedToolbar: true });
    const run = vi.fn();
    const setTextDirection = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ setTextDirection }));
    const chain = vi.fn(() => ({ focus }));
    const editor = makeEditorMock({
      getAttributes: (name) => (name === 'paragraph' || name === 'heading' ? { dir: 'ltr' } : {}),
    });
    (editor as unknown as { chain: typeof chain }).chain = chain;

    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    fireEvent.click(btn);

    expect(setTextDirection).toHaveBeenCalledWith('rtl');
    expect(run).toHaveBeenCalled();
  });

  it('calls setTextDirection("ltr") when clicked on RTL paragraph', () => {
    setPreferences({ advancedToolbar: true });
    const run = vi.fn();
    const setTextDirection = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ setTextDirection }));
    const chain = vi.fn(() => ({ focus }));
    const editor = makeEditorMock({
      getAttributes: (name) => (name === 'paragraph' || name === 'heading' ? { dir: 'rtl' } : {}),
    });
    (editor as unknown as { chain: typeof chain }).chain = chain;

    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    fireEvent.click(btn);

    expect(setTextDirection).toHaveBeenCalledWith('ltr');
    expect(run).toHaveBeenCalled();
  });
});
