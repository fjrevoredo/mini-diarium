import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  mkdtempSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import type { Options } from '@wdio/types';

// temp dir for isolated diary state — each run gets a fresh empty directory
const testDataDir = mkdtempSync(join(tmpdir(), 'mini-diarium-e2e-'));

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

  // onPrepare runs in the main process before any workers start.
  // This is the correct place to spawn tauri-driver so it is listening
  // on port 4444 before wdio workers attempt to create a WebDriver session.
  onPrepare: async () => {
    // Strip TAURI_DEV so it doesn't leak into the app binary at runtime
    const { TAURI_DEV: _drop, ...cleanEnv } = process.env;

    tauriDriver = spawn('tauri-driver', nativeDriverArgs(), {
      stdio: 'inherit',
      env: { ...cleanEnv, MINI_DIARIUM_DATA_DIR: testDataDir },
    });
    // Give tauri-driver time to bind to port 4444 before workers connect
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));
  },

  // onComplete runs in the main process after all workers have finished.
  onComplete: () => {
    tauriDriver?.kill();
  },
};
