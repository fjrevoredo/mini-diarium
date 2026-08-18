import { spawn, spawnSync } from 'node:child_process';

const env = { ...process.env, MINI_DIARIUM_FONTS_DIR: '../fonts' };
const args = process.argv.slice(2);

const child = spawn('bun', ['x', 'tauri', ...args], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

let childExited = false;
let terminating = false;

function terminateChild() {
  if (childExited || terminating || child.pid === undefined) return;
  terminating = true;

  if (process.platform === 'win32') {
    // `child` is the cmd.exe shell created by `spawn(..., { shell: true })`.
    // Kill its complete tree so Tauri's cargo watcher and Vite beforeDevCommand
    // cannot survive a Ctrl+C or a parent-process shutdown.
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'inherit',
    });
  } else {
    child.kill('SIGTERM');
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, terminateChild);
}
process.once('exit', terminateChild);

child.on('error', (error) => {
  childExited = true;
  console.error('Failed to start Tauri:', error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  childExited = true;
  process.exitCode = code ?? (signal ? 1 : 0);
});
