import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import EditorToolbar from './EditorToolbar';
import { setPreferences, DEFAULT_TOOLBAR_ITEMS } from '../../state/preferences';
import type { Editor } from '@tiptap/core';

const { mockListBundledFonts, mockListCustomFonts } = vi.hoisted(() => ({
  mockListBundledFonts: vi.fn<() => Promise<string[]>>().mockResolvedValue(['Font A', 'Font B']),
  mockListCustomFonts: vi
    .fn<() => Promise<import('../../lib/tauri').CustomFontSummary[]>>()
    .mockResolvedValue([]),
}));

vi.mock('../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tauri')>('../../lib/tauri');
  return {
    ...actual,
    listBundledFonts: mockListBundledFonts,
    listCustomFonts: mockListCustomFonts,
  };
});

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
  const chainResult = {
    run,
    setTextAlign: vi.fn(() => chainResult),
    toggleBold: vi.fn(() => chainResult),
    toggleItalic: vi.fn(() => chainResult),
    setFontFamily: vi.fn(() => chainResult),
    unsetFontFamily: vi.fn(() => chainResult),
    setFontSize: vi.fn(() => chainResult),
    unsetFontSize: vi.fn(() => chainResult),
  };
  const focus = vi.fn(() => chainResult);
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
  // Reset to default preferences before each test (all items disabled by default in tests)
  setPreferences({
    toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
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
// Underline button — visibility
// ---------------------------------------------------------------------------

describe('EditorToolbar underline button — visibility', () => {
  it('shows underline button when underline item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'underline',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Underline (Ctrl/Cmd+U)"]')).not.toBeNull();
  });

  it('hides underline button when underline item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Underline (Ctrl/Cmd+U)"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Color buttons — visibility
// ---------------------------------------------------------------------------

describe('EditorToolbar color buttons — visibility', () => {
  it('hides text color and highlight color buttons when items are disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Text color"]')).toBeNull();
    expect(container.querySelector('[aria-label="Highlight color"]')).toBeNull();
  });

  it('shows text color and highlight color buttons when items are enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textColor' || i.key === 'highlightColor',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Text color"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Highlight color"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Alignment buttons — visibility
// ---------------------------------------------------------------------------

describe('EditorToolbar alignment buttons — visibility', () => {
  it('hides alignment buttons when alignment item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);

    expect(container.querySelector('[aria-label="Align left"]')).toBeNull();
    expect(container.querySelector('[aria-label="Align center"]')).toBeNull();
    expect(container.querySelector('[aria-label="Align right"]')).toBeNull();
    expect(container.querySelector('[aria-label="Justify"]')).toBeNull();
  });

  it('shows all four alignment buttons when alignment item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'alignment',
      })),
    });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
    setPreferences({ toolbarItems: DEFAULT_TOOLBAR_ITEMS });
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
  it('hides the import markdown button when importMarkdown item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Import Markdown file"]')).toBeNull();
  });

  it('shows the import markdown button when importMarkdown item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'importMarkdown',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Import Markdown file"]')).not.toBeNull();
  });

  it('calls onImportMarkdown when the button is clicked', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'importMarkdown',
      })),
    });
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
  it('hides the insert timestamp button when insertTimestamp item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Insert timestamp"]')).toBeNull();
  });

  it('shows the insert timestamp button when insertTimestamp item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'insertTimestamp',
      })),
    });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Insert timestamp"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Text direction button
// ---------------------------------------------------------------------------

describe('Text direction button', () => {
  it('hides the text direction button when textDirection item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Text direction"]')).toBeNull();
  });

  it('shows the text direction button when textDirection item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textDirection',
      })),
    });
    const editor = makeEditorMock();
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    expect(container.querySelector('[aria-label="Text direction"]')).not.toBeNull();
  });

  it('marks the button as active for RTL paragraph', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textDirection',
      })),
    });
    const editor = makeEditorMock({
      getAttributes: (name) => (name === 'paragraph' ? { dir: 'rtl' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    expect(btn.className).toContain('btn-active');
  });

  it('does not mark the button as active for LTR paragraph', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textDirection',
      })),
    });
    const editor = makeEditorMock({
      getAttributes: (name) => (name === 'paragraph' ? { dir: 'ltr' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    expect(btn.className).not.toContain('btn-active');
  });

  it('does not mark the button as active when dir is absent', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textDirection',
      })),
    });
    const editor = makeEditorMock({
      getAttributes: () => ({}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[aria-label="Text direction"]') as HTMLButtonElement;
    expect(btn.className).not.toContain('btn-active');
  });

  it('calls setTextDirection("rtl") when clicked on LTR paragraph', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textDirection',
      })),
    });
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
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'textDirection',
      })),
    });
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

// ---------------------------------------------------------------------------
// fontFamily item — visibility and options
// ---------------------------------------------------------------------------

describe('EditorToolbar fontFamily item — visibility', () => {
  it('hides font family select when fontFamily item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Font family"]')).toBeNull();
  });

  it('shows font family select when fontFamily item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Font family"]')).not.toBeNull();
  });

  it('has system-default option when fontFamily item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('');
  });

  it('has bundled font options when fontFamily item is enabled', async () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    await vi.waitFor(() => {
      const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain('Font A');
      expect(options).toContain('Font B');
    });
  });
});

// ---------------------------------------------------------------------------
// fontSize item — visibility and options
// ---------------------------------------------------------------------------

describe('EditorToolbar fontSize item — visibility', () => {
  it('hides font size select when fontSize item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Font size"]')).toBeNull();
  });

  it('shows font size select when fontSize item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontSize',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[aria-label="Font size"]')).not.toBeNull();
  });

  it('has all 13 size options (12–24) plus a default unset option when fontSize item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontSize',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    const select = container.querySelector('[aria-label="Font size"]') as HTMLSelectElement;
    const allOptions = Array.from(select.options);
    // First option is the "Default" unset option (value = '')
    expect(allOptions[0].value).toBe('');
    // Remaining 13 are the fixed sizes 12–24
    const sizeValues = allOptions.slice(1).map((o) => Number(o.value));
    expect(sizeValues).toHaveLength(13);
    expect(sizeValues[0]).toBe(12);
    expect(sizeValues[12]).toBe(24);
  });

  it('shows "Default" as selected when no inline font size is active', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontSize',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    const select = container.querySelector('[aria-label="Font size"]') as HTMLSelectElement;
    const selected = Array.from(select.options).find((o) => o.selected);
    expect(selected?.value).toBe('');
  });

  it('shows inline font size as selected when active', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontSize',
      })),
    });
    const editorWith18px = makeEditorMock({
      getAttributes: (name: string) => (name === 'textStyle' ? { fontSize: '18px' } : {}),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editorWith18px} />);
    const select = container.querySelector('[aria-label="Font size"]') as HTMLSelectElement;
    const selected = Array.from(select.options).find((o) => o.selected);
    expect(selected?.value).toBe('18');
  });
});

// ---------------------------------------------------------------------------
// fontFamily item — custom font options
// ---------------------------------------------------------------------------

describe('EditorToolbar fontFamily item — custom font options', () => {
  it('shows custom font in the font-family selector alongside bundled fonts', async () => {
    mockListBundledFonts.mockResolvedValue(['BundledFont']);
    mockListCustomFonts.mockResolvedValue([
      { family: 'MyCustomFont', has_regular: true, has_bold: false },
    ]);
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);

    await waitFor(() => {
      const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain('BundledFont');
      expect(values).toContain('MyCustomFont');
    });
  });

  it('does not show custom fonts without a Regular weight', async () => {
    mockListBundledFonts.mockResolvedValue([]);
    mockListCustomFonts.mockResolvedValue([
      { family: 'BoldOnly', has_regular: false, has_bold: true },
    ]);
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);

    await waitFor(() => {
      // Wait for resources to resolve
      expect(container.querySelector('[aria-label="Font family"]')).not.toBeNull();
    });

    const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).not.toContain('BoldOnly');
  });

  it('shows inline active font family as selected in the toolbar selector', async () => {
    mockListBundledFonts.mockResolvedValue([]);
    mockListCustomFonts.mockResolvedValue([
      { family: 'SelectedCustom', has_regular: true, has_bold: true },
    ]);
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const editorWithFont = makeEditorMock({
      getAttributes: (name: string) =>
        name === 'textStyle' ? { fontFamily: 'SelectedCustom' } : {},
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editorWithFont} />);

    await waitFor(() => {
      const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain('SelectedCustom');
    });

    const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
    const selected = Array.from(select.options).find((o) => o.selected);
    expect(selected?.value).toBe('SelectedCustom');
  });

  it('shows empty option when no inline font family is active', async () => {
    mockListBundledFonts.mockResolvedValue(['Font A']);
    mockListCustomFonts.mockResolvedValue([]);
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'fontFamily',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);

    await waitFor(() => {
      expect(container.querySelector('[aria-label="Font family"]')).not.toBeNull();
    });

    const select = container.querySelector('[aria-label="Font family"]') as HTMLSelectElement;
    const selected = Array.from(select.options).find((o) => o.selected);
    expect(selected?.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Link button — visibility and behavior
// ---------------------------------------------------------------------------

describe('EditorToolbar link button — visibility', () => {
  it('hides the link button when link item is disabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({ ...i, enabled: false })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[data-testid="insert-link-button"]')).toBeNull();
  });

  it('shows the link button when link item is enabled', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'link',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    expect(container.querySelector('[data-testid="insert-link-button"]')).not.toBeNull();
  });

  it('opens the LinkOverlay when the link button is clicked', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'link',
      })),
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={makeEditorMock()} />);
    const btn = container.querySelector('[data-testid="insert-link-button"]') as HTMLButtonElement;
    fireEvent.click(btn);
    // LinkOverlay renders its content through a Kobalte Portal at document root
    expect(document.querySelector('[data-testid="link-url-input"]')).not.toBeNull();
  });

  it('marks the link button as active when isActive("link") is true', () => {
    setPreferences({
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((i) => ({
        ...i,
        enabled: i.key === 'link',
      })),
    });
    const editor = makeEditorMock({
      isActive: (nameOrAttrs) => nameOrAttrs === 'link',
    });
    const { container } = renderWithI18n(() => <EditorToolbar editor={editor} />);
    const btn = container.querySelector('[data-testid="insert-link-button"]') as HTMLButtonElement;
    expect(btn.className).toContain('btn-active');
  });
});

describe('EditorToolbar — locked (read-only) state', () => {
  it('dims the toolbar and blocks pointer interaction when locked', () => {
    const { getByRole } = renderWithI18n(() => (
      <EditorToolbar editor={makeEditorMock()} locked={true} />
    ));
    const toolbar = getByRole('toolbar');
    expect(toolbar.getAttribute('aria-disabled')).toBe('true');
    expect(toolbar.className).toContain('pointer-events-none');
  });

  it('does not disable the toolbar when not locked', () => {
    const { getByRole } = renderWithI18n(() => (
      <EditorToolbar editor={makeEditorMock()} locked={false} />
    ));
    const toolbar = getByRole('toolbar');
    expect(toolbar.getAttribute('aria-disabled')).toBeNull();
    expect(toolbar.className).not.toContain('pointer-events-none');
  });
});
