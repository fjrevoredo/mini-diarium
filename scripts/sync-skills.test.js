import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { cleanupLibrarySkillMirrors } from './sync-skills.js';

function makeTempRoot(name) {
  const root = join(
    tmpdir(),
    `sync-skills-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  return root;
}

function createDir(path, fileName = 'marker.txt') {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, fileName), 'ok');
}

function createDirectoryLink(targetPath, linkPath) {
  symlinkSync(targetPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

test('cleanupLibrarySkillMirrors removes live and broken links plus physical stale mirrors only', () => {
  const root = makeTempRoot('cleanup');
  const sourceRoot = join(root, '.agents', 'skills');
  const targetRoot = join(root, '.claude', 'skills');

  try {
    mkdirSync(sourceRoot, { recursive: true });
    mkdirSync(targetRoot, { recursive: true });

    const liveSource = join(root, 'canonical-live');
    createDir(liveSource);

    const liveMirror = join(targetRoot, 'add-locale');
    createDirectoryLink(liveSource, liveMirror);

    const brokenTarget = join(root, 'missing-canonical');
    const brokenMirror = join(targetRoot, 'apply-dependency-prs');
    createDirectoryLink(brokenTarget, brokenMirror);

    const physicalMirror = join(targetRoot, 'diagram-maintainer');
    createDir(physicalMirror, 'stale.txt');

    const untouchedSibling = join(targetRoot, 'manual-planning');
    createDir(untouchedSibling, 'keep.txt');

    const removed = cleanupLibrarySkillMirrors({
      targetRoot,
      sourceRoot,
      skillNames: new Set(['add-locale', 'apply-dependency-prs', 'diagram-maintainer']),
    });

    assert.deepEqual(removed.map((entry) => [entry.skillName, entry.type]).sort(), [
      ['add-locale', 'link'],
      ['apply-dependency-prs', 'link'],
      ['diagram-maintainer', 'directory'],
    ]);
    assert.equal(existsSync(liveMirror), false);
    assert.equal(existsSync(brokenMirror), false);
    assert.equal(existsSync(physicalMirror), false);
    assert.equal(existsSync(join(liveSource, 'marker.txt')), true);
    assert.equal(readFileSync(join(liveSource, 'marker.txt'), 'utf8'), 'ok');
    assert.equal(existsSync(join(untouchedSibling, 'keep.txt')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('cleanupLibrarySkillMirrors refuses cleanup while canonical source still exists', () => {
  const root = makeTempRoot('guard');
  const sourceRoot = join(root, '.agents', 'skills');
  const targetRoot = join(root, '.claude', 'skills');

  try {
    const sourcePath = join(sourceRoot, 'review-external-pr');
    const mirrorPath = join(targetRoot, 'review-external-pr');
    createDir(sourcePath);
    mkdirSync(targetRoot, { recursive: true });
    createDir(mirrorPath);

    assert.throws(
      () =>
        cleanupLibrarySkillMirrors({
          targetRoot,
          sourceRoot,
          skillNames: new Set(['review-external-pr']),
        }),
      /canonical source still exists/,
    );
    assert.equal(existsSync(mirrorPath), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
