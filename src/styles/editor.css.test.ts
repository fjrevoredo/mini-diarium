/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Regression guard for https://github.com/fjrevoredo/mini-diarium/issues/163
// The Tailwind reset (list-style: none) erases bullet/number markers globally.
// These rules must explicitly restore them inside ProseMirror or lists appear blank.
describe('editor.css list-style-type reset guard', () => {
  const css = readFileSync(resolve('src/styles/editor.css'), 'utf-8');

  it('restores disc bullets on .ProseMirror ul', () => {
    expect(css).toMatch(/\.ProseMirror ul\s*\{[^}]*list-style-type:\s*disc/s);
  });

  it('restores decimal numbers on .ProseMirror ol', () => {
    expect(css).toMatch(/\.ProseMirror ol\s*\{[^}]*list-style-type:\s*decimal/s);
  });
});
