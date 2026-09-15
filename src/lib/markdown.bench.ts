import { test } from 'vitest';
import { parseMarkdownToHtml } from './markdown';

// ~100 words: a short diary entry
const SHORT_MD =
  `# Journal Entry\n\nToday was **productive**. Finished the implementation.\n`.repeat(5);
// ~1000 words: a long diary entry
const LONG_MD = SHORT_MD.repeat(20);

test('parseMarkdownToHtml', async ({ bench }) => {
  await bench('short entry (~100 words)', () => {
    parseMarkdownToHtml(SHORT_MD);
  }).run();
  await bench('long entry (~1000 words)', () => {
    parseMarkdownToHtml(LONG_MD);
  }).run();
});
