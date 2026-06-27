import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInstallActions } from './install-hooks.js';

test('skips everything when CI=true', () => {
  const r = computeInstallActions({
    isCI: true,
    hasGitDir: true,
    hasHookFile: true,
    platform: 'linux',
  });
  assert.equal(r.setHooksPath, false);
  assert.equal(r.chmodHook, false);
});

test('skips everything when .git is absent (non-git context)', () => {
  const r = computeInstallActions({
    isCI: false,
    hasGitDir: false,
    hasHookFile: true,
    platform: 'linux',
  });
  assert.equal(r.setHooksPath, false);
  assert.equal(r.chmodHook, false);
});

test('sets core.hooksPath when in a git repo on a non-Windows platform', () => {
  const r = computeInstallActions({
    isCI: false,
    hasGitDir: true,
    hasHookFile: true,
    platform: 'linux',
  });
  assert.equal(r.setHooksPath, true);
  assert.equal(r.chmodHook, true);
});

test('sets core.hooksPath but skips chmod on Windows', () => {
  const r = computeInstallActions({
    isCI: false,
    hasGitDir: true,
    hasHookFile: true,
    platform: 'win32',
  });
  assert.equal(r.setHooksPath, true);
  assert.equal(r.chmodHook, false);
});

test('sets core.hooksPath even when hook file is missing (idempotent install path)', () => {
  const r = computeInstallActions({
    isCI: false,
    hasGitDir: true,
    hasHookFile: false,
    platform: 'linux',
  });
  assert.equal(r.setHooksPath, true);
  assert.equal(r.chmodHook, false);
});

test('CI takes precedence over git-dir presence', () => {
  const r = computeInstallActions({
    isCI: true,
    hasGitDir: true,
    hasHookFile: false,
    platform: 'darwin',
  });
  assert.equal(r.setHooksPath, false);
  assert.equal(r.chmodHook, false);
});
