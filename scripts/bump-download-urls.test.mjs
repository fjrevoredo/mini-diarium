import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('validates complete download URLs before writing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-urls-'));
  const path = join(dir, 'index.html');
  const source = ['windows.exe', 'macos.dmg', 'linux.AppImage'].map((platform) => `<a href="https://github.com/fjrevoredo/mini-diarium/releases/download/v1.2.3/Mini-Diarium-1.2.3-${platform}">`).join('\n');
  try {
    writeFileSync(path, source.replace('windows.exe', 'windows.exe.broken'));
    assert.notEqual(spawnSync(process.execPath, ['scripts/bump-download-urls.mjs', '1.2.4', path]).status, 0);
    assert.match(readFileSync(path, 'utf8'), /windows\.exe\.broken/);
    writeFileSync(path, source);
    assert.equal(spawnSync(process.execPath, ['scripts/bump-download-urls.mjs', '1.2.4', path]).status, 0);
    assert.match(readFileSync(path, 'utf8'), /download\/v1\.2\.4\/Mini-Diarium-1\.2\.4-windows\.exe/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
