import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const REQUIRED_D2_VERSION = "0.7.1";
const REQUIRED_MMDC_VERSION = "11.12.0";

// D2 version guard
const d2Result = spawnSync("d2", ["--version"], { encoding: "utf8" });
if (d2Result.error) {
  console.error(`❌ D2 not found. Install v${REQUIRED_D2_VERSION}: https://d2lang.com`);
  process.exit(1);
}
const d2Version = d2Result.stdout.trim().replace(/^v/, "");
if (d2Version !== REQUIRED_D2_VERSION) {
  console.error(`❌ D2 version mismatch: found ${d2Version}, need ${REQUIRED_D2_VERSION}`);
  console.error(`Install D2 v${REQUIRED_D2_VERSION}: https://d2lang.com`);
  process.exit(1);
}

// mermaid-cli version guard
let mmdcVersion;
try {
  const pkg = JSON.parse(
    readFileSync(path.resolve("node_modules/@mermaid-js/mermaid-cli/package.json"), "utf8"),
  );
  mmdcVersion = pkg.version;
} catch {
  console.error("❌ @mermaid-js/mermaid-cli not installed. Run: bun install");
  process.exit(1);
}
if (mmdcVersion !== REQUIRED_MMDC_VERSION) {
  console.error(`❌ mermaid-cli version mismatch: found ${mmdcVersion}, need ${REQUIRED_MMDC_VERSION}`);
  console.error("Run: bun install");
  process.exit(1);
}

// Regenerate all diagrams in-place
const renderResult = spawnSync("bun", ["run", "diagrams"], { stdio: "inherit" });
if (renderResult.status !== 0) {
  process.exit(renderResult.status ?? 1);
}

// Content-diff check
const diffResult = spawnSync("git", ["diff", "--name-only", "docs/diagrams/"], { encoding: "utf8" });
const changedFiles = diffResult.stdout.trim();
if (changedFiles) {
  console.error("❌ Diagrams are stale — the following SVGs changed after regeneration:");
  for (const f of changedFiles.split("\n")) {
    console.error(`   ${f}`);
  }
  console.error("Run: bun run diagrams && git add docs/diagrams/ && git commit");
  process.exit(1);
}

console.log("✅ All diagrams up to date");
