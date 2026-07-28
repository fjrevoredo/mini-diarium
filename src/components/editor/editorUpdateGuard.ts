import type { Transaction } from '@tiptap/pm/state';

/**
 * Whether a TipTap `update` event represents an actual change to the document.
 *
 * TipTap emits `update` for things that are not user edits. `Editor.setEditable()` emits
 * one synthetically (`emit('update', { transaction: this.state.tr, ... })`), bypassing
 * `dispatchTransaction` and its `docChanged` check entirely — so the payload carries an
 * empty transaction and whatever the document happens to hold at that instant.
 *
 * Treating such an event as a keystroke is how a loaded entry body got wiped: between
 * `commitEntryToEditor` publishing the body to the `content` signal and DiaryEditor's
 * content-sync effect applying it to TipTap, the document is still the *previous* (empty)
 * one. A synthetic update in that window overwrites `content` with the empty document; the
 * sync effect then sees `props.content === editor.getHTML()`, skips, and the entry is
 * persisted blank with its title intact. See TODO-0089.
 *
 * The root transaction alone is not sufficient: `dispatchTransaction` emits when *any*
 * transaction in the batch changed the document, so a plugin-appended change (e.g.
 * `BidiExtension` writing `dir` attributes) can be the only one carrying `docChanged`.
 */
export function isDocumentChange(
  transaction: Transaction,
  appendedTransactions: readonly Transaction[],
): boolean {
  return transaction.docChanged || appendedTransactions.some((tr) => tr.docChanged);
}
