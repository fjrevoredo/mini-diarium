## What's Changed

Mini Diarium 0.7.2 fixes two problems with non-Latin text. Word counts now treat each Han, Hiragana, or Katakana character as one word instead of counting a whole sentence as a single word, and search accepts one-character queries when they contain CJK text, so common two-character Chinese and Japanese words and phrases are findable again.

### Fixed

- **CJK word counts and short search queries were wrong (#275)**: Chinese and Japanese text has no spaces between words, so the word counter (which only split on whitespace) counted an entire sentence as a single word; it now counts each Han, Hiragana, or Katakana character individually while Latin and Korean text keep the existing whitespace-delimited counting, and the saved word count and the live in-editor count use the identical rule. Separately, the search box's three-character minimum blocked common two-character Chinese and Japanese words and phrases; the minimum now drops to one character for queries that contain CJK text and stays at three for everything else.