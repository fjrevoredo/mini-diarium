import { describe, it, expect } from 'vitest';
import type { Transaction } from '@tiptap/pm/state';
import { isDocumentChange } from './editorUpdateGuard';

/**
 * Only the `docChanged` flag is read, so a minimal stand-in is enough — constructing real
 * ProseMirror transactions would require an editor, and TipTap refuses to mount in jsdom.
 */
const tr = (docChanged: boolean) => ({ docChanged }) as Transaction;

describe('isDocumentChange', () => {
  it('accepts a real edit (root transaction changed the document)', () => {
    expect(isDocumentChange(tr(true), [])).toBe(true);
  });

  it('rejects a synthetic update carrying an unchanged transaction', () => {
    // This is exactly what Editor.setEditable() emits: `this.state.tr`, untouched.
    // Forwarding it as an edit is what wiped a freshly loaded entry body (TODO-0089).
    expect(isDocumentChange(tr(false), [])).toBe(false);
  });

  it('accepts a change contributed only by an appended plugin transaction', () => {
    // BidiExtension appends a `dir`-attribute transaction; dispatchTransaction emits when
    // ANY transaction in the batch changed the document, so the root may be unchanged.
    expect(isDocumentChange(tr(false), [tr(false), tr(true)])).toBe(true);
  });

  it('rejects when neither the root nor any appended transaction changed the document', () => {
    expect(isDocumentChange(tr(false), [tr(false), tr(false)])).toBe(false);
  });
});
