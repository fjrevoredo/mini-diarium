#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, chmodSync } from 'node:fs';
import { platform } from 'node:process';
import { fileURLToPath } from 'node:url';

export function computeInstallActions({ isCI, hasGitDir, hasHookFile, platform }) {
  return {
    setHooksPath: !isCI && hasGitDir,
    chmodHook: !isCI && hasGitDir && hasHookFile && platform !== 'win32',
  };
}

function main() {
  const actions = computeInstallActions({
    isCI: process.env.CI === 'true',
    hasGitDir: existsSync('.git'),
    hasHookFile: existsSync('.githooks/pre-commit'),
    platform,
  });

  if (!actions.setHooksPath) {
    console.log('install-hooks: skipped (CI or non-git context)');
    return;
  }

  // All args are hardcoded literals — no user input involved.
  const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' }); // NOSONAR
  if (result.error || result.status !== 0) {
    return;
  }
  console.log('install-hooks: core.hooksPath = .githooks');

  if (actions.chmodHook) {
    try {
      chmodSync('.githooks/pre-commit', 0o755);
    } catch {
      // non-fatal
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
