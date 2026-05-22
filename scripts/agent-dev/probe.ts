import {
  fetchJson,
  findMatchingPageTarget,
  formatDurationSeconds,
  getExpectedDevUrl,
  isPidAlive,
  isWindows,
  printWindowsOnlyError,
  readState,
  type CdpTarget,
  type CdpVersionInfo,
} from './common.js';

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/agent-dev/probe.ts

Checks whether the recorded agent-dev session is still healthy.
`);
}

function getManagedPids(state: { pid: number; managed_pids?: number[] }): number[] {
  return state.managed_pids && state.managed_pids.length > 0
    ? [...new Set(state.managed_pids)]
    : [state.pid];
}

function fail(reason: string): never {
  console.log(JSON.stringify({ running: false, reason }));
  process.exit(1);
}

async function main(): Promise<void> {
  if (!isWindows()) {
    printWindowsOnlyError();
  }

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.length > 0) {
    throw new Error(`Unknown argument(s): ${args.join(' ')}`);
  }

  const state = readState();
  if (!state) {
    fail('no state file');
  }

  const managedPids = getManagedPids(state);
  const alivePids = managedPids.filter((pid) => isPidAlive(pid));
  if (alivePids.length === 0) {
    fail('managed pids not alive');
  }

  let version: CdpVersionInfo;
  let targets: CdpTarget[];

  try {
    version = await fetchJson<CdpVersionInfo>(`http://localhost:${state.port}/json/version`, 2000);
    targets = await fetchJson<CdpTarget[]>(`http://localhost:${state.port}/json`, 2000);
  } catch {
    fail('cdp unreachable');
  }

  if (!version.webSocketDebuggerUrl) {
    fail('cdp version payload missing websocket URL');
  }

  const expectedUrl = state.page_url ?? getExpectedDevUrl();
  const pageTarget = findMatchingPageTarget(targets, expectedUrl);
  if (!pageTarget?.url) {
    fail('expected page target not found');
  }

  console.log(
    JSON.stringify({
      running: true,
      pid: state.pid,
      managed_pids: managedPids,
      port: state.port,
      page_url: pageTarget.url,
      uptime_seconds: formatDurationSeconds(state.started_at),
    }),
  );
}

await main();
