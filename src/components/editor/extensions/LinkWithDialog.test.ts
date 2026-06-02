import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEditorLinkClick } from './LinkWithDialog';

const { mockOpenUrl } = vi.hoisted(() => ({
  mockOpenUrl: vi.fn<() => Promise<void>>().mockResolvedValue(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: mockOpenUrl,
}));

beforeEach(() => {
  mockOpenUrl.mockClear();
});

// ---------------------------------------------------------------------------
// buildEvent — synthesize a click event with the given target + modifier
// state. The preventDefault spy lives on the event itself.
// ---------------------------------------------------------------------------

interface FakeClickEvent {
  target: EventTarget | null;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  preventDefault: ReturnType<typeof vi.fn>;
  defaultPrevented: boolean;
}

function buildEvent(opts: {
  target: EventTarget | null;
  metaKey?: boolean;
  ctrlKey?: boolean;
  button?: number;
}): FakeClickEvent {
  const event: FakeClickEvent = {
    target: opts.target,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: false,
    altKey: false,
    button: opts.button ?? 0,
    preventDefault: vi.fn(function (this: FakeClickEvent) {
      this.defaultPrevented = true;
    }),
    defaultPrevented: false,
  };
  return event;
}

function makeAnchor(href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  a.textContent = 'label';
  document.body.appendChild(a);
  return a;
}

describe('handleEditorLinkClick — anchor detection', () => {
  it('returns false when the click target is not an anchor', () => {
    const span = document.createElement('span');
    span.textContent = 'text';
    document.body.appendChild(span);
    const event = buildEvent({ target: span });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);
    expect(result).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  it('returns false when there is no event target', () => {
    const event = buildEvent({ target: null });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);
    expect(result).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe('handleEditorLinkClick — plain click on an anchor', () => {
  it('calls preventDefault so the WebView does NOT navigate, but does NOT open the URL', () => {
    const anchor = makeAnchor('https://example.com');
    const event = buildEvent({ target: anchor });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);

    // preventDefault stops the WebView from trying to navigate to the href.
    // Tauri additionally blocks navigation via on_navigation, but the
    // explicit preventDefault is belt-and-suspenders and stops the click
    // from producing any visible browser action.
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(result).toBe(false); // not consumed: ProseMirror should still place the caret
    expect(mockOpenUrl).not.toHaveBeenCalled();
    document.body.removeChild(anchor);
  });

  it('calls preventDefault even when the anchor has no href', () => {
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    const event = buildEvent({ target: anchor });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(result).toBe(false);
    expect(mockOpenUrl).not.toHaveBeenCalled();
    document.body.removeChild(anchor);
  });

  it('handles clicks on a descendant of an anchor (e.g. the link text)', () => {
    const anchor = makeAnchor('https://example.com');
    const inner = document.createElement('span');
    inner.textContent = 'click here';
    anchor.appendChild(inner);
    const event = buildEvent({ target: inner });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(result).toBe(false);
    expect(mockOpenUrl).not.toHaveBeenCalled();
    document.body.removeChild(anchor);
  });
});

describe('handleEditorLinkClick — modifier click on an anchor', () => {
  it('opens the URL in the system browser on Ctrl+click', () => {
    const anchor = makeAnchor('https://example.com');
    const event = buildEvent({ target: anchor, ctrlKey: true });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(result).toBe(true);
    expect(mockOpenUrl).toHaveBeenCalledWith('https://example.com');
    document.body.removeChild(anchor);
  });

  it('opens the URL in the system browser on Cmd+click (macOS)', () => {
    const anchor = makeAnchor('https://example.com');
    const event = buildEvent({ target: anchor, metaKey: true });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(result).toBe(true);
    expect(mockOpenUrl).toHaveBeenCalledWith('https://example.com');
    document.body.removeChild(anchor);
  });

  it('does not call openUrl if the anchor has no href', () => {
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    const event = buildEvent({ target: anchor, ctrlKey: true });
    handleEditorLinkClick(event as unknown as MouseEvent);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mockOpenUrl).not.toHaveBeenCalled();
    document.body.removeChild(anchor);
  });
});

describe('handleEditorLinkClick — non-anchor clicks', () => {
  it('does not prevent default for clicks on plain text', () => {
    const span = document.createElement('span');
    span.textContent = 'plain text';
    document.body.appendChild(span);
    const event = buildEvent({ target: span });
    const result = handleEditorLinkClick(event as unknown as MouseEvent);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(result).toBe(false);
    expect(mockOpenUrl).not.toHaveBeenCalled();
    document.body.removeChild(span);
  });
});

// ---------------------------------------------------------------------------
// Schema-default tests — pin the Link extension's `target` attribute
// default so a future TipTap upgrade (which could change the hardcoded
// default) cannot silently re-introduce the `target="_blank"` regression.
// ---------------------------------------------------------------------------

import { LinkWithDialog } from './LinkWithDialog';

describe('LinkWithDialog — schema defaults', () => {
  // ProseMirror extensions expose the resolved config via
  // `extension.config`. We call our `addAttributes` override directly
  // with a synthetic `this` whose `parent()` returns the original
  // Link's attribute definitions, so we exercise the real override path.
  function getResolvedTargetDefault(): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stubThis: any = {
      name: 'link',
      parent: () => ({
        href: { default: null, parseHTML: () => null },
        target: { default: '_blank' },
        rel: { default: 'noopener noreferrer nofollow' },
        class: { default: null },
        title: { default: null },
      }),
    };
    const addAttributes = LinkWithDialog.config.addAttributes;
    if (!addAttributes) return undefined;
    const attrs = addAttributes.call(stubThis);
    // The return type is `{} | Attributes`; treat as a generic object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = (attrs as any)?.target;
    return target?.default;
  }

  it('does not default to "_blank" (avoids Tauri WebView external handoff)', () => {
    const targetDefault = getResolvedTargetDefault();
    // The override must produce a target default that ProseMirror's
    // DOMSerializer will skip (i.e., null or undefined). If a future
    // TipTap upgrade removes the override, the hardcoded '_blank' would
    // re-surface and clicks on links would open externally again.
    expect(targetDefault == null).toBe(true);
  });
});
