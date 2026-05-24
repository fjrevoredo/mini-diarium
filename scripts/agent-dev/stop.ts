import {
  fetchJson,
  formatDurationSeconds,
  isPidAlive,
  isWindows,
  printWindowsOnlyError,
  readState,
  removeSandbox,
  removeState,
  taskkill,
} from './common.js';

interface StopOptions {
  keepSandbox: boolean;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/agent-dev/stop.ts [options]

Options:
  --keep-sandbox         Keep .agent-dev/sandbox after stopping
  --help                 Show this help
`);
}

function parseArgs(argv: string[]): StopOptions {
  const options: StopOptions = {
    keepSandbox: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--keep-sandbox':
        options.keepSandbox = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function portClosed(port: number): Promise<boolean> {
  try {
    await fetchJson(`http://localhost:${port}/json/version`, 1500);
    return false;
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  if (!isWindows()) {
    printWindowsOnlyError();
  }

  const options = parseArgs(process.argv.slice(2));
  const state = readState();

  if (!state) {
    console.log('no dev instance recorded');
    return;
  }

  const rootPids =
    state.managed_pids && state.managed_pids.length > 0
      ? [...new Set(state.managed_pids)]
      : [state.pid];
  const alivePids = rootPids.filter((pid) => isPidAlive(pid));
  const killResults = alivePids.map((pid) => ({
    pid,
    result: taskkill(pid),
  }));
  const closed = await portClosed(state.port);

  if (!closed) {
    if (alivePids.length === 0) {
      console.error(
        `recorded root PIDs are not alive, but port ${state.port} is still open; leaving state file in place for manual cleanup.`,
      );
    } else {
      console.error(
        `port ${state.port} is still open after taskkill; leaving state file in place for manual cleanup.`,
      );
    }

    for (const { pid, result } of killResults) {
      if (!result.ok) {
        console.error(`taskkill failed for PID ${pid} with code ${result.code}`);
      }
      if (result.stdout.trim()) {
        console.error(result.stdout.trim());
      }
      if (result.stderr.trim()) {
        console.error(result.stderr.trim());
      }
    }

    process.exit(1);
  }

  if (!options.keepSandbox) {
    removeSandbox();
  }
  removeState();

  console.log(`Stopped tauri dev: pids=${rootPids.join(', ')} port=${state.port}`);
  console.log(`Was alive: ${alivePids.length > 0 ? 'yes' : 'no'}`);
  console.log(`Port closed: ${closed ? 'yes' : 'no'}`);
  console.log(`Sandbox: ${options.keepSandbox ? 'kept' : 'removed'}`);
  console.log(`Uptime (recorded): ${formatDurationSeconds(state.started_at)}s`);

  for (const { pid, result } of killResults) {
    if (!result.ok) {
      console.warn(`taskkill exited with code ${result.code} for PID ${pid}`);
    }
    if (result.stdout.trim()) {
      console.warn(result.stdout.trim());
    }
    if (result.stderr.trim()) {
      console.warn(result.stderr.trim());
    }
  }
}

await main();
