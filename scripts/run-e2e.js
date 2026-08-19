#!/usr/bin/env node
import { spawnSync } from 'child_process';

const validModes = new Set(['clean', 'stateful']);
const modeArg = process.argv[2] ?? 'clean';
const passthroughArgs = process.argv.slice(3);

if (!validModes.has(modeArg)) {
  console.error(`Invalid E2E mode: "${modeArg}". Use "clean" or "stateful".`);
  process.exit(1);
}

const IS_WIN = process.platform === 'win32';

// On Windows, "wdio" resolves to a .cmd shim; spawnSync can't exec that directly
// (CreateProcess has no PATHEXT resolution) so it fails with ENOENT even though
// `bun run test:e2e` works from a shell. Routing through cmd.exe /c fixes this the
// same way scripts/render-diagrams.mjs and scripts/check-diff-coverage.mjs do.
const wdioCommand = IS_WIN ? 'cmd.exe' : 'wdio';
const wdioArgs = IS_WIN
  ? ['/d', '/s', '/c', 'wdio', 'run', 'wdio.conf.ts', ...passthroughArgs]
  : ['run', 'wdio.conf.ts', ...passthroughArgs];

const result = spawnSync(wdioCommand, wdioArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_MODE: modeArg,
  },
});

process.exit(result.status ?? 1);
