#!/usr/bin/env node
import { spawnSync } from 'child_process';

const validModes = new Set(['clean', 'stateful']);
const modeArg = process.argv[2] ?? 'clean';
const passthroughArgs = process.argv.slice(3);

if (!validModes.has(modeArg)) {
  console.error(`Invalid E2E mode: "${modeArg}". Use "clean" or "stateful".`);
  process.exit(1);
}

const result = spawnSync('wdio', ['run', 'wdio.conf.ts', ...passthroughArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_MODE: modeArg,
  },
});

process.exit(result.status ?? 1);
