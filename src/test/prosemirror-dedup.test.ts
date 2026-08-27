/// <reference types="node" />
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// Regression guard for https://github.com/fjrevoredo/mini-diarium/issues/273
// (full RCA: docs/archive/2026-08-27-issue-273-enter-key-rca.md).
//
// A duplicate prosemirror-model install silently breaks TipTap's node-splitting and
// node-wrapping commands (Enter at the end of a paragraph, list/blockquote toggling):
// `Transaction.split`'s `NodeType.create`/`Fragment.from` throws a RangeError when it
// crosses the module boundary between two loaded copies, and the exception escapes before
// `preventDefault()` runs, so the keystroke silently does nothing instead of surfacing an
// error. package-lock.json/npm never produced the duplicate; it was a bun-hoisting gap
// introduced by the @tiptap/* ^3.30.1 bump (07bff56), fixed via the "prosemirror-model"
// entry in package.json's "overrides" block. A component-level test cannot catch this:
// Vitest resolves a single hoisted prosemirror-model from node_modules regardless of what
// bun's own tree looks like, so this walks the installed tree directly instead.

/** Finds every `prosemirror-model` package directory anywhere under `node_modules`. */
function findProsemirrorModelCopies(dir: string, found: string[], visited: Set<string>): void {
  let real: string;
  try {
    real = realpathSync(dir);
  } catch {
    return; // dangling symlink or unreadable — not this guard's concern
  }
  if (visited.has(real)) return;
  visited.add(real);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name === '.bin') continue;
    if (entry.name === 'prosemirror-model') {
      found.push(join(dir, entry.name));
      continue; // a prosemirror-model dir has no nested prosemirror-model of its own
    }
    findProsemirrorModelCopies(join(dir, entry.name), found, visited);
  }
}

describe('prosemirror-model install dedup guard', () => {
  it('resolves to exactly one installed copy', () => {
    const copies: string[] = [];
    findProsemirrorModelCopies(join(process.cwd(), 'node_modules'), copies, new Set());

    if (copies.length > 1) {
      const versions = copies.map((path) => {
        try {
          const { version } = JSON.parse(readFileSync(join(path, 'package.json'), 'utf-8'));
          return `${path} (${version})`;
        } catch {
          return path;
        }
      });
      throw new Error(
        `Found ${copies.length} copies of prosemirror-model:\n${versions.join('\n')}\n` +
          `Add/fix "prosemirror-model" in package.json's "overrides" block, then re-run the sync-lockfiles skill.`,
      );
    }

    expect(copies).toHaveLength(1);
  });
});
