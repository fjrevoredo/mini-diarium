import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('editor.css timestamp styling', () => {
  it('does not fade or shrink the inserted timestamp span (TODO-0103)', () => {
    const css = readFileSync(join(__dirname, 'editor.css'), 'utf-8');

    // The timestamp must inherit color/font-size/font-family from the editor
    // body text — no rule may reintroduce opacity or a non-default font-size
    // on `.timestamp`, or the inserted stamp will visibly mismatch the
    // surrounding text again.
    expect(css).not.toMatch(/\.timestamp\s*\{[^}]*(opacity|font-size)/);
  });
});
