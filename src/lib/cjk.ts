// Mirrors the hand-rolled ranges in count_words
// (crates/mini-diarium-core/src/db/queries/entries/mod.rs).
// Korean (Hangul, U+AC00–U+D7A3) is deliberately excluded — see TODO-0110-01.
export function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // Han
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // Han Ext A
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // Han Compatibility
    (codePoint >= 0x3040 && codePoint <= 0x309f) || // Hiragana
    (codePoint >= 0x30a0 && codePoint <= 0x30ff) || // Katakana
    (codePoint >= 0x31f0 && codePoint <= 0x31ff) // Katakana Phonetic Ext
  );
}

export function containsCjk(text: string): boolean {
  for (const ch of text) {
    if (isCjkCodePoint(ch.codePointAt(0)!)) return true;
  }
  return false;
}
