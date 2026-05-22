import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  type AgentDevState,
  type CdpTarget,
  type CdpVersionInfo,
  ensureAgentDevRoot,
  ensureSandboxJournalConfig,
  ensureSandboxDirs,
  fetchJson,
  findMatchingPageTarget,
  getExpectedDevUrl,
  isPidAlive,
  isWindows,
  listChildProcessIds,
  logPath,
  printWindowsOnlyError,
  readLogTail,
  readState,
  repoRoot,
  sandboxAppDir,
  sandboxDataDir,
  sandboxWebviewDir,
  sleep,
  statePath,
  taskkill,
  writeState,
} from './common.js';

interface StartOptions {
  port: number;
  timeoutSeconds: number;
  useRealConfig: boolean;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/agent-dev/start.ts [options]

Options:
  --port <number>         CDP port to expose (default: 9222)
  --timeout <seconds>     Startup timeout in seconds (default: 120)
  --use-real-config       Use the real app/data dirs instead of the sandbox
  --help                  Show this help
`);
}

function parseArgs(argv: string[]): StartOptions {
  const options: StartOptions = {
    port: 9222,
    timeoutSeconds: 120,
    useRealConfig: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--port': {
        const value = argv[index + 1];
        if (!value) {
          throw new Error('--port requires a value.');
        }

        options.port = Number(value);
        index += 1;
        break;
      }
      case '--timeout': {
        const value = argv[index + 1];
        if (!value) {
          throw new Error('--timeout requires a value.');
        }

        options.timeoutSeconds = Number(value);
        index += 1;
        break;
      }
      case '--use-real-config':
        options.useRealConfig = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.port) || options.port <= 0 || options.port > 65535) {
    throw new Error(`Invalid --port value: ${options.port}`);
  }

  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new Error(`Invalid --timeout value: ${options.timeoutSeconds}`);
  }

  return options;
}

async function endpointAvailable(port: number): Promise<boolean> {
  try {
    await fetchJson<CdpVersionInfo>(`http://localhost:${port}/json/version`, 1500);
    return true;
  } catch {
    return false;
  }
}

async function pollForCdp(
  pid: number,
  port: number,
  timeoutSeconds: number,
  expectedDevUrl: string,
): Promise<{
  version: CdpVersionInfo;
  targets: CdpTarget[];
  pageTarget: CdpTarget | null;
}> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastVersion: CdpVersionInfo | null = null;
  let lastTargets: CdpTarget[] = [];
  let lastPageTarget: CdpTarget | null = null;

  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      throw new Error(`tauri dev exited before CDP was ready (pid ${pid}).`);
    }

    try {
      const version = await fetchJson<CdpVersionInfo>(
        `http://localhost:${port}/json/version`,
        2000,
      );
      const targets = await fetchJson<CdpTarget[]>(`http://localhost:${port}/json`, 2000);
      const pageTarget = findMatchingPageTarget(targets, expectedDevUrl);

      lastVersion = version;
      lastTargets = targets;
      lastPageTarget = pageTarget;

      if (pageTarget) {
        return {
          version,
          targets,
          pageTarget,
        };
      }
    } catch {}

    await sleep(500);
  }

  if (lastVersion) {
    return {
      version: lastVersion,
      targets: lastTargets,
      pageTarget: lastPageTarget,
    };
  }

  throw new Error(`Timed out waiting for CDP endpoint at http://localhost:${port}/json/version.`);
}

async function main(): Promise<void> {
  if (!isWindows()) {
    printWindowsOnlyError();
  }

  const options = parseArgs(process.argv.slice(2));
  const expectedDevUrl = getExpectedDevUrl();
  const recordedState = readState();

  const recordedRootPids =
    recordedState?.managed_pids && recordedState.managed_pids.length > 0
      ? recordedState.managed_pids
      : recordedState
        ? [recordedState.pid]
        : [];

  if (
    recordedState &&
    recordedState.port === options.port &&
    recordedRootPids.some((recordedPid) => isPidAlive(recordedPid))
  ) {
    try {
      const version = await fetchJson<CdpVersionInfo>(
        recordedState.cdp_http + '/json/version',
        2000,
      );
      const targets = await fetchJson<CdpTarget[]>(recordedState.cdp_http + '/json', 2000);
      const pageTarget = findMatchingPageTarget(targets, expectedDevUrl);

      if (version.webSocketDebuggerUrl && pageTarget) {
        console.log(
          `reusing existing dev instance: pids=${recordedRootPids.join(', ')} port=${recordedState.port}`,
        );
        return;
      }
    } catch {
      console.warn(`stale state in ${statePath}; starting a fresh dev instance.`);
    }
  }

  if (await endpointAvailable(options.port)) {
    throw new Error(
      `CDP port ${options.port} is already in use by another process. Use --port <N> or stop the existing listener.`,
    );
  }

  ensureAgentDevRoot();

  const env = {
    ...process.env,
    MINI_DIARIUM_FONTS_DIR: resolve(repoRoot, 'fonts'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${options.port}`,
  };

  let sandbox: AgentDevState['sandbox'] = null;
  if (!options.useRealConfig) {
    ensureSandboxDirs();
    ensureSandboxJournalConfig();
    env.MINI_DIARIUM_DATA_DIR = sandboxDataDir;
    env.MINI_DIARIUM_APP_DIR = sandboxAppDir;
    env.MINI_DIARIUM_WEBVIEW_DATA_DIR = sandboxWebviewDir;
    sandbox = {
      data_dir: sandboxDataDir,
      app_dir: sandboxAppDir,
      webview_dir: sandboxWebviewDir,
    };
  }

  const logFd = openSync(logPath, 'a');
  let pid: number | null = null;

  try {
    const child = spawn(
      process.execPath,
      [resolve(repoRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), 'dev'],
      {
        cwd: repoRoot,
        env,
        detached: false,
        stdio: ['ignore', logFd, logFd],
        windowsHide: true,
      },
    );

    pid = child.pid ?? null;
    if (!pid) {
      throw new Error('Failed to spawn tauri dev process.');
    }

    child.unref();

    const { version, targets, pageTarget } = await pollForCdp(
      pid,
      options.port,
      options.timeoutSeconds,
      expectedDevUrl,
    );

    const managedPids = listChildProcessIds(pid);
    const rootPids = managedPids.length > 0 ? managedPids : [pid];

    const state: AgentDevState = {
      pid: rootPids[0],
      managed_pids: rootPids,
      port: options.port,
      cdp_http: `http://localhost:${options.port}`,
      cdp_browser_ws: version.webSocketDebuggerUrl,
      cdp_page_ws: pageTarget?.webSocketDebuggerUrl ?? null,
      page_url: pageTarget?.url ?? null,
      sandbox,
      started_at: new Date().toISOString(),
    };

    writeState(state);

    if (!pageTarget) {
      console.warn(
        `warning: no page target matched ${expectedDevUrl}; falling back to browser-level websocket.`,
      );
    }

    console.log('Tauri dev running.');
    console.log(`PID roots: ${rootPids.join(', ')}`);
    console.log(`CDP:      http://localhost:${options.port}`);
    console.log(`Page URL: ${state.page_url ?? '(not found)'}`);
    console.log(`State:    ${statePath}`);
    console.log(`Sandbox:  ${sandbox ? sandboxDataDir : '(real config)'}`);
    console.log(`Next:     agent-browser connect ${options.port}`);
    console.log('Stop:     bun run agent:dev:stop');
  } catch (error) {
    if (pid && isPidAlive(pid)) {
      taskkill(pid);
    }

    const tail = readLogTail();
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (tail) {
      console.error('\nLast log lines:\n');
      console.error(tail);
    }
    process.exit(1);
  } finally {
    closeSync(logFd);
  }
}

await main();
