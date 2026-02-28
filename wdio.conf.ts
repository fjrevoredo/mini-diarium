import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  mkdtempSync,
  existsSync,
  readdirSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import type { Options } from '@wdio/types';

type E2eMode = 'clean' | 'stateful';
const e2eMode: E2eMode = process.env['E2E_MODE'] === 'stateful' ? 'stateful' : 'clean';
const isCleanMode = e2eMode === 'clean';
const statefulRoot = process.env['E2E_STATEFUL_ROOT'] ?? join(process.cwd(), '.e2e-stateful');

// temp dirs for clean-room E2E isolation
const testDataDir = isCleanMode ? mkdtempSync(join(tmpdir(), 'mini-diarium-e2e-data-')) : null;
const testAppDir = isCleanMode ? mkdtempSync(join(tmpdir(), 'mini-diarium-e2e-app-')) : null;
const testWebviewDir =
  isCleanMode && process.platform === 'win32'
    ? mkdtempSync(join(tmpdir(), 'mini-diarium-e2e-webview-'))
    : null;
const statefulDataDir = !isCleanMode ? join(statefulRoot, 'data') : null;
const statefulAppDir = !isCleanMode ? join(statefulRoot, 'app') : null;
const statefulWebviewDir =
  !isCleanMode && process.platform === 'win32' ? join(statefulRoot, 'webview') : null;
const diaryDataDir = isCleanMode ? testDataDir : statefulDataDir;
const appConfigDir = isCleanMode ? testAppDir : statefulAppDir;
const webviewUserDataDir = isCleanMode ? testWebviewDir : statefulWebviewDir;

// tauri-driver process handle
let tauriDriver: ChildProcess;

// Resolve binary path to an absolute path — tauri-driver requires this on Windows
const appBinary = resolve(
  process.cwd(),
  process.platform === 'win32'
    ? 'src-tauri/target/release/mini-diarium.exe'
    : 'src-tauri/target/release/mini-diarium',
);

// Local cache for downloaded msedgedriver binaries
const driversDir = join(process.cwd(), '.drivers');

/**
 * Find the installed WebView2 runtime version on Windows.
 * tauri-driver drives the WebView2 runtime embedded in the Tauri window,
 * not the Edge browser itself — so msedgedriver must match the WebView2 version,
 * which can differ from the installed Edge browser version.
 */
function detectWebView2Version(): string | null {
  const x86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
  const local = process.env['LOCALAPPDATA'] ?? '';

  const candidates = [
    join(x86, 'Microsoft', 'EdgeWebView', 'Application'),
    join(local, 'Microsoft', 'EdgeWebView', 'Application'),
  ];

  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      const versions = readdirSync(dir)
        .filter((v) => /^\d+\.\d+/.test(v))
        .sort()
        .reverse();
      if (versions.length > 0) return versions[0];
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Ensure a cached msedgedriver matching the given version exists in .drivers/.
 * Downloads from the Microsoft CDN using PowerShell if not already cached.
 * Returns the path to the cached binary.
 */
function ensureCachedDriver(version: string): string {
  mkdirSync(driversDir, { recursive: true });
  const driverPath = join(driversDir, `msedgedriver-${version}.exe`);

  if (existsSync(driverPath)) {
    console.log(`[wdio] Using cached msedgedriver ${version}`);
    return driverPath;
  }

  console.log(`[wdio] Downloading msedgedriver ${version} from Microsoft CDN...`);
  const url = `https://msedgedriver.microsoft.com/${version}/edgedriver_win64.zip`;
  const zipPath = join(driversDir, `msedgedriver-${version}.zip`);
  const extractDir = join(driversDir, `extract-${version}`);

  const ps = [
    `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`,
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
    `Move-Item -Force '${extractDir}\\msedgedriver.exe' '${driverPath}'`,
    `Remove-Item -Recurse -Force '${zipPath}', '${extractDir}'`,
  ].join('; ');

  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    stdio: 'inherit',
  });

  if (result.status !== 0 || !existsSync(driverPath)) {
    throw new Error(
      `[wdio] Failed to download msedgedriver ${version}.\n` +
        `Download manually from: ${url}\n` +
        `Extract msedgedriver.exe and place it at: ${driverPath}`,
    );
  }

  console.log(`[wdio] Cached msedgedriver ${version} → ${driverPath}`);
  return driverPath;
}

/**
 * Returns the --native-driver args for tauri-driver on Windows.
 * Detects the WebView2 runtime version and supplies a matching msedgedriver.
 * On Linux/macOS returns [] — tauri-driver uses webkit2gtk-driver / safaridriver.
 */
function nativeDriverArgs(): string[] {
  if (process.platform !== 'win32') return [];

  const version = detectWebView2Version();
  if (!version) {
    console.warn(
      '[wdio] Could not detect WebView2 runtime version. ' +
        'tauri-driver will search PATH for msedgedriver.',
    );
    return [];
  }

  console.log(`[wdio] Detected WebView2 runtime version: ${version}`);
  const driverPath = ensureCachedDriver(version);
  return ['--native-driver', driverPath];
}

function removeTempDir(path: string | null): void {
  if (!path) return;
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[wdio] Failed to remove temp dir ${path}:`, error);
  }
}

export const config: Options.Testrunner = {
  specs: ['./e2e/specs/**/*.spec.ts'],
  maxInstances: 1,

  capabilities: [
    {
      // Windows uses WebView2 (Edge-based) → msedgedriver expects 'edge'.
      // Linux uses WebKitGTK → WebKitWebDriver (webkit2gtk-driver) does not
      // recognise 'edge', and an empty string '' is also rejected (treated as
      // a non-matching value, not as "omit"). Spreading nothing omits the key
      // from the JSON entirely, which satisfies WebKitWebDriver's W3C
      // capability matching ("no browserName constraint" == match any).
      ...(process.platform === 'win32' ? { browserName: 'edge' } : {}),
      // Disable WebDriver BiDi — wdio v9 enables it by default but it conflicts
      // with Tauri's custom tauri://localhost URI scheme. Classic WebDriver
      // protocol is what tauri-driver was designed for.
      'wdio:enforceWebDriverClassic': true,
      // @ts-expect-error — tauri:options is not in the standard WebDriver types
      'tauri:options': {
        application: appBinary,
        ...(process.platform === 'win32' && webviewUserDataDir
          ? {
              webviewOptions: {
                userDataFolder: webviewUserDataDir,
              },
            }
          : {}),
      },
    },
  ],

  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Connect to tauri-driver (default port 4444)
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  before: async () => {
    if (!isCleanMode) return;

    // Force deterministic viewport so responsive breakpoints do not depend on host state.
    await browser.setWindowSize(800, 660);
    const size = await browser.getWindowSize();
    if (size.width !== 800 || size.height !== 660) {
      await browser.pause(250);
      await browser.setWindowSize(800, 660);
    }
  },

  // onPrepare runs in the main process before any workers start.
  // This is the correct place to spawn tauri-driver so it is listening
  // on port 4444 before wdio workers attempt to create a WebDriver session.
  onPrepare: async () => {
    // Strip TAURI_DEV so it doesn't leak into the app binary at runtime
    const { TAURI_DEV: _drop, ...cleanEnv } = process.env;
    console.log(`[wdio] E2E mode: ${e2eMode}`);
    if (statefulDataDir) {
      mkdirSync(statefulDataDir, { recursive: true });
    }
    if (statefulWebviewDir) {
      mkdirSync(statefulWebviewDir, { recursive: true });
    }

    // Pre-create isolated config.json so the JournalPicker has exactly 1 journal configured
    // and does not read the developer's real config.json during E2E runs.
    if (isCleanMode && appConfigDir && diaryDataDir) {
      writeFileSync(
        join(appConfigDir, 'config.json'),
        JSON.stringify({
          journals: [{ id: 'e2e', name: 'E2E Journal', path: diaryDataDir }],
          active_journal_id: 'e2e',
        }),
      );
    }
    if (!isCleanMode && statefulAppDir && statefulDataDir) {
      mkdirSync(statefulAppDir, { recursive: true });
      // Seed config.json on first run only — leave it intact on subsequent runs so
      // diary content persists across test executions (the point of stateful mode).
      const statefulConfigPath = join(statefulAppDir, 'config.json');
      if (!existsSync(statefulConfigPath)) {
        writeFileSync(
          statefulConfigPath,
          JSON.stringify({
            journals: [{ id: 'e2e-stateful', name: 'E2E Stateful Journal', path: statefulDataDir }],
            active_journal_id: 'e2e-stateful',
          }),
        );
      }
    }

    tauriDriver = spawn('tauri-driver', nativeDriverArgs(), {
      stdio: 'inherit',
      env: {
        ...cleanEnv,
        ...(diaryDataDir
          ? {
              MINI_DIARIUM_DATA_DIR: diaryDataDir,
            }
          : {}),
        ...(appConfigDir
          ? {
              MINI_DIARIUM_APP_DIR: appConfigDir,
            }
          : {}),
        MINI_DIARIUM_E2E: isCleanMode ? '1' : '0',
      },
    });
    // Give tauri-driver time to bind to port 4444 before workers connect
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));
  },

  // onComplete runs in the main process after all workers have finished.
  onComplete: () => {
    tauriDriver?.kill();
    removeTempDir(testDataDir);
    removeTempDir(testAppDir);
    removeTempDir(testWebviewDir);
  },
};
