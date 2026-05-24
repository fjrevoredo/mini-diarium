import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AgentDevState {
  pid: number;
  managed_pids?: number[];
  port: number;
  cdp_http: string;
  cdp_browser_ws: string;
  cdp_page_ws: string | null;
  page_url: string | null;
  sandbox: {
    data_dir: string;
    app_dir: string;
    webview_dir?: string;
  } | null;
  started_at: string;
}

export interface CdpTarget {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

export interface CdpVersionInfo {
  Browser: string;
  'Protocol-Version': string;
  webSocketDebuggerUrl: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, '../..');
export const agentDevRoot = resolve(repoRoot, '.agent-dev');
export const sandboxRoot = resolve(agentDevRoot, 'sandbox');
export const sandboxDataDir = resolve(sandboxRoot, 'data');
export const sandboxAppDir = resolve(sandboxRoot, 'app');
export const sandboxWebviewDir = resolve(sandboxRoot, 'webview');
export const sandboxConfigPath = resolve(sandboxAppDir, 'config.json');
export const statePath = resolve(agentDevRoot, 'state.json');
export const logPath = resolve(agentDevRoot, 'dev.log');
export const tauriConfigPath = resolve(repoRoot, 'src-tauri', 'tauri.conf.json');

export function ensureAgentDevRoot(): void {
  mkdirSync(agentDevRoot, { recursive: true });
}

export function ensureSandboxDirs(): void {
  mkdirSync(sandboxDataDir, { recursive: true });
  mkdirSync(sandboxAppDir, { recursive: true });
  mkdirSync(sandboxWebviewDir, { recursive: true });
}

interface SandboxJournalConfig {
  journals?: Array<{
    id?: string;
    name?: string;
    path?: string;
    db_filename?: string;
    auto_key?: string | null;
  }>;
  active_journal_id?: string | null;
}

export function ensureSandboxJournalConfig(): void {
  ensureSandboxDirs();

  if (existsSync(sandboxConfigPath)) {
    try {
      const current = JSON.parse(readFileSync(sandboxConfigPath, 'utf8')) as SandboxJournalConfig;
      const journals = Array.isArray(current.journals) ? current.journals : [];
      const activeJournalId =
        typeof current.active_journal_id === 'string' ? current.active_journal_id : null;

      if (journals.length > 0) {
        if (activeJournalId && journals.some((journal) => journal.id === activeJournalId)) {
          return;
        }

        const firstJournalId = journals[0]?.id;
        if (firstJournalId) {
          current.active_journal_id = firstJournalId;
          writeFileSync(sandboxConfigPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
          return;
        }
      }
    } catch {}
  }

  const seededConfig = {
    journals: [
      {
        id: 'agent-dev',
        name: 'Agent Dev Journal',
        path: sandboxDataDir,
      },
    ],
    active_journal_id: 'agent-dev',
  };

  writeFileSync(sandboxConfigPath, `${JSON.stringify(seededConfig, null, 2)}\n`, 'utf8');
}

export function removeSandbox(): void {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

export function readState(): AgentDevState | null {
  if (!existsSync(statePath)) {
    return null;
  }

  return JSON.parse(readFileSync(statePath, 'utf8')) as AgentDevState;
}

export function writeState(state: AgentDevState): void {
  ensureAgentDevRoot();
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function removeState(): void {
  rmSync(statePath, { force: true });
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function getExpectedDevUrl(): string {
  const parsed = JSON.parse(readFileSync(tauriConfigPath, 'utf8')) as {
    build?: { devUrl?: string };
  };
  return parsed.build?.devUrl ?? 'http://localhost:1420';
}

export function findMatchingPageTarget(
  targets: CdpTarget[],
  expectedDevUrl: string,
): CdpTarget | null {
  const normalized = expectedDevUrl.endsWith('/') ? expectedDevUrl : `${expectedDevUrl}/`;

  const match =
    targets.find((target) => target.url === expectedDevUrl || target.url === normalized) ??
    targets.find((target) => target.url?.startsWith(normalized)) ??
    null;

  return match;
}

export function readLogTail(lineCount = 40): string {
  if (!existsSync(logPath)) {
    return '';
  }

  const content = readFileSync(logPath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line, index, array) => {
    return !(index === array.length - 1 && line === '');
  });
  return lines.slice(-lineCount).join('\n');
}

export function taskkill(pid: number): {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], {
    encoding: 'utf8',
    windowsHide: true,
  });

  return {
    ok: result.status === 0,
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function listChildProcessIds(parentPid: number): number[] {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}" | Select-Object -ExpandProperty ProcessId`,
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map((line) => Number(line));
}

export function resolveBunExecutable(): string {
  const result = spawnSync('where', ['bun'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error('Could not resolve bun.exe on PATH.');
  }

  const firstLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    throw new Error('Could not resolve bun.exe on PATH.');
  }

  return firstLine;
}

export function formatDurationSeconds(startedAt: string): number {
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export function printWindowsOnlyError(): never {
  console.error(
    'tauri-agent-dev is Windows-only for v1. macOS WKWebView has no CDP; Linux WebKitGTK uses a different protocol.',
  );
  process.exit(2);
}
