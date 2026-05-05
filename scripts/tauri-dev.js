import { spawn } from "node:child_process";

const env = { ...process.env, MINI_DIARIUM_FONTS_DIR: "../fonts" };
const args = process.argv.slice(2);

const child = spawn("bun", ["x", "tauri", ...args], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
