import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { escapeHtml, readImageDimensions, slugify } from './website-generator-utils.mjs';

function makeTempRoot(name) {
  const root = join(
    tmpdir(),
    `website-generator-utils-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  return root;
}

test('escapeHtml escapes the five reserved characters', () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('slugify lowercases, replaces runs of non-alphanumerics, and trims edges', () => {
  assert.equal(slugify('  Hello, World!  '), 'hello-world');
});

test('readImageDimensions reads width/height from an SVG root element', () => {
  const root = makeTempRoot('svg');
  try {
    const filePath = join(root, 'diagram.svg');
    writeFileSync(
      filePath,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect/></svg>',
    );

    assert.deepEqual(readImageDimensions(filePath), { width: 100, height: 50 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readImageDimensions returns null for an SVG missing width/height', () => {
  const root = makeTempRoot('svg-missing');
  try {
    const filePath = join(root, 'diagram.svg');
    writeFileSync(filePath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect/></svg>');

    assert.equal(readImageDimensions(filePath), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function riffHeader(fourCC, chunkData) {
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + 8 + chunkData.length, 4);
  header.write('WEBP', 8, 'ascii');

  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write(fourCC, 0, 'ascii');
  chunkHeader.writeUInt32LE(chunkData.length, 4);

  return Buffer.concat([header, chunkHeader, chunkData]);
}

test('readImageDimensions reads a VP8 (lossy) WebP header', () => {
  const root = makeTempRoot('vp8');
  try {
    const filePath = join(root, 'lossy.webp');
    const chunkData = Buffer.alloc(10);
    chunkData.writeUIntLE(0, 0, 3); // frame tag
    chunkData.writeUIntLE(0x2a019d, 3, 3); // start code 0x9d 0x01 0x2a (little-endian order)
    chunkData.writeUInt16LE(500, 6); // width
    chunkData.writeUInt16LE(660, 8); // height
    writeFileSync(filePath, riffHeader('VP8 ', chunkData));

    assert.deepEqual(readImageDimensions(filePath), { width: 500, height: 660 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readImageDimensions reads a VP8L (lossless) WebP header', () => {
  const root = makeTempRoot('vp8l');
  try {
    const filePath = join(root, 'lossless.webp');
    const chunkData = Buffer.alloc(5);
    chunkData.writeUInt8(0x2f, 0); // signature
    const width = 940;
    const height = 850;
    const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
    chunkData.writeUInt32LE(bits, 1);
    writeFileSync(filePath, riffHeader('VP8L', chunkData));

    assert.deepEqual(readImageDimensions(filePath), { width, height });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readImageDimensions reads a VP8X (extended) WebP header', () => {
  const root = makeTempRoot('vp8x');
  try {
    const filePath = join(root, 'extended.webp');
    const chunkData = Buffer.alloc(10);
    const width = 1440;
    const height = 900;
    chunkData.writeUIntLE(width - 1, 4, 3);
    chunkData.writeUIntLE(height - 1, 7, 3);
    writeFileSync(filePath, riffHeader('VP8X', chunkData));

    assert.deepEqual(readImageDimensions(filePath), { width, height });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readImageDimensions returns null for a missing file', () => {
  const root = makeTempRoot('missing');
  try {
    assert.equal(readImageDimensions(join(root, 'does-not-exist.webp')), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readImageDimensions returns null for a non-image file', () => {
  const root = makeTempRoot('non-image');
  try {
    const filePath = join(root, 'notes.txt');
    writeFileSync(filePath, 'just some text');

    assert.equal(readImageDimensions(filePath), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
