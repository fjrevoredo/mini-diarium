import { isCjkCodePoint } from './cjk';

/**
 * Count words in a plain-text string (no HTML stripping needed).
 * Used with TipTap's `editor.getText()` output.
 * Mirrors the Rust `count_words` state machine (crates/mini-diarium-core/src/db/queries/entries/mod.rs):
 * each Han/Hiragana/Katakana character counts as its own word, never merging with an
 * adjacent CJK character — see TODO-0110-01.
 */
export function countWordsFromText(text: string): number {
  let count = 0;
  let inWord = false;

  for (const ch of text) {
    if (isCjkCodePoint(ch.codePointAt(0)!)) {
      if (inWord) {
        count++;
        inWord = false;
      }
      count++;
    } else if (/\s/.test(ch)) {
      if (inWord) {
        count++;
        inWord = false;
      }
    } else {
      inWord = true;
    }
  }

  if (inWord) count++;

  return count;
}

/**
 * Count words in an HTML string by stripping tags via the same state machine as
 * `countWordsFromText`. Safe for entries with embedded base64 images — tag content
 * (including base64 attribute blobs) is skipped entirely, not scanned for words.
 */
export function countWordsInHtml(html: string): number {
  let count = 0;
  let inTag = false;
  let inWord = false;

  for (const ch of html) {
    if (ch === '<') {
      inTag = true;
      if (inWord) {
        count++;
        inWord = false;
      }
    } else if (ch === '>') {
      inTag = false;
    } else if (!inTag) {
      if (isCjkCodePoint(ch.codePointAt(0)!)) {
        if (inWord) {
          count++;
          inWord = false;
        }
        count++;
      } else if (/\s/.test(ch)) {
        if (inWord) {
          count++;
          inWord = false;
        }
      } else {
        inWord = true;
      }
    }
  }

  if (inWord) count++;

  return count;
}
