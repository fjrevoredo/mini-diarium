import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { expectedAssets, verifyChecksum, pageLinks } from './release-verify.mjs';

test('checks exact asset names and SHA-256 content', () => {
  const assets = expectedAssets('1.2.3');
  assert.equal(assets.length, 5);
  const bytes = Buffer.from('fixture');
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.ok(verifyChecksum(`${hash}  ${assets[0]}\n`, assets[0], bytes));
  assert.ok(!verifyChecksum(`${hash}  ${assets[0]}\n`, assets[0], Buffer.from('changed')));
});

test('requires three version-pinned website links', () => {
  const html = ['windows.exe', 'macos.dmg', 'linux.AppImage'].map((s) => `<a href="https://github.com/fjrevoredo/mini-diarium/releases/download/v1.2.3/Mini-Diarium-1.2.3-${s}">`).join('');
  assert.ok(pageLinks(html, '1.2.3'));
  assert.ok(!pageLinks(html.replace('download/v1.2.3', 'latest/download'), '1.2.3'));
});
