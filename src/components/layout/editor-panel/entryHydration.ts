import { batch, type Setter } from 'solid-js';
import { getEntryImages } from '../../../lib/tauri';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import { hasImageRefs, resolveImageRefs } from '../../../lib/image-refs';
import { countWordsInHtml } from '../../../lib/wordcount';
import { createLogger } from '../../../lib/logger';

const log = createLogger('Editor');

/**
 * The setters that together answer "which entry is the editor showing?". They must only
 * ever be written as one atomic group — see `commitEntryToEditor`.
 */
export interface EntryCommitTargets {
  setCurrentIndex: Setter<number>;
  setPendingEntryId: Setter<number | null>;
  setTitle: Setter<string>;
  setContent: Setter<string>;
  setWordCount: Setter<number>;
  setEntryMetadata: Setter<EntryMetadata | null>;
  /** Records the entry whose body has actually reached the editor. */
  setHydratedEntryId: (id: number | null) => void;
}

/**
 * Resolves an entry's `image-id://` refs into displayable data URLs.
 *
 * Never rejects: a failed lookup degrades to the raw text (unresolved refs) rather than
 * aborting the caller mid-load. Aborting is what used to leave `pendingEntryId`/`title`
 * committed for an entry whose body never reached the editor — the next flush then
 * persisted the blank editor as that entry's content. See TODO-0089.
 */
export async function resolveEntryHtml(entry: DiaryEntry): Promise<string> {
  if (!hasImageRefs(entry.text)) return entry.text;
  try {
    const images = await getEntryImages(entry.id);
    return resolveImageRefs(entry.text, images);
  } catch (error) {
    log.warn(`resolveEntryHtml: image lookup failed for entry ${entry.id}:`, error);
    return entry.text;
  }
}

/**
 * Commits id + title + body + metadata as one indivisible unit.
 *
 * The invariant this exists to enforce: the editor must never advertise that it is
 * editing entry N while still holding entry M's body (or no body at all). Every
 * "flush before navigating away" path re-reads those signals live, so a half-applied
 * state turns into `save_entry(N, title, '')` — a silent body wipe with the title left
 * intact. Resolve everything the commit needs (image refs included) BEFORE calling
 * this, and re-check the caller's request/token guard on the line immediately above.
 */
export function commitEntryToEditor(
  targets: EntryCommitTargets,
  entry: DiaryEntry,
  html: string,
  index: number | null = null,
): void {
  batch(() => {
    if (index !== null) targets.setCurrentIndex(index);
    targets.setPendingEntryId(entry.id);
    targets.setTitle(entry.title);
    targets.setContent(html);
    targets.setWordCount(countWordsInHtml(html));
    targets.setEntryMetadata(entry.metadata ?? null);
    targets.setHydratedEntryId(entry.id);
  });
}

/** Resets the editor to "no entry open" — same atomicity contract as `commitEntryToEditor`. */
export function clearEntryFromEditor(targets: EntryCommitTargets): void {
  batch(() => {
    targets.setCurrentIndex(0);
    targets.setPendingEntryId(null);
    targets.setTitle('');
    targets.setContent('');
    targets.setWordCount(0);
    targets.setEntryMetadata(null);
    targets.setHydratedEntryId(null);
  });
}
