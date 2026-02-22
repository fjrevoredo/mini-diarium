import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DIAGRAMS_DIR = path.resolve("docs/diagrams");

const MERMAID_DIAGRAMS = [
  { source: "unlock.mmd", outputBase: "unlock.svg", transparent: false },
  { source: "unlock-dark.mmd", outputBase: "unlock-dark.svg", transparent: true },
  { source: "save-entry.mmd", outputBase: "save-entry.svg", transparent: false },
  { source: "save-entry-dark.mmd", outputBase: "save-entry-dark.svg", transparent: true },
  { source: "context.mmd", outputBase: "context.svg", transparent: false },
  { source: "context-dark.mmd", outputBase: "context-dark.svg", transparent: true },
];

const D2_DIAGRAMS = [
  { source: "architecture.d2", outputBase: "architecture.svg" },
  { source: "architecture-dark.d2", outputBase: "architecture-dark.svg" },
];

function getArgValue(name, fallbackValue = "") {
  const prefixed = `${name}=`;
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith(prefixed)) {
      return arg.slice(prefixed.length);
    }
    if (arg === name && i + 1 < args.length) {
      return args[i + 1];
    }
  }

  return fallbackValue;
}

function withSuffix(fileName, suffix) {
  if (!suffix) {
    return fileName;
  }

  if (!fileName.endsWith(".svg")) {
    throw new Error(`Expected .svg output file, got: ${fileName}`);
  }

  return `${fileName.slice(0, -4)}${suffix}.svg`;
}

function runOrExit(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const suffix = getArgValue("--suffix", "");
const explicitPuppeteerConfig = getArgValue("--puppeteer-config", "").trim();
let generatedPuppeteerDir = "";
let puppeteerConfigPath = explicitPuppeteerConfig || process.env.MMDC_PUPPETEER_CONFIG || "";

if (!puppeteerConfigPath && process.env.CI === "true" && process.platform === "linux") {
  generatedPuppeteerDir = mkdtempSync(path.join(tmpdir(), "mini-diarium-mmdc-"));
  puppeteerConfigPath = path.join(generatedPuppeteerDir, "puppeteer-config.json");

  writeFileSync(
    puppeteerConfigPath,
    `${JSON.stringify(
      {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

try {
  for (const diagram of MERMAID_DIAGRAMS) {
    const inputPath = path.join(DIAGRAMS_DIR, diagram.source);
    const outputPath = path.join(DIAGRAMS_DIR, withSuffix(diagram.outputBase, suffix));

    const args = ["run", "mmdc", "--", "-i", inputPath, "-o", outputPath];

    if (puppeteerConfigPath) {
      args.push("-p", puppeteerConfigPath);
    }

    if (diagram.transparent) {
      args.push("--backgroundColor", "transparent");
    }

    runOrExit("bun", args);
  }

  for (const diagram of D2_DIAGRAMS) {
    const inputPath = path.join(DIAGRAMS_DIR, diagram.source);
    const outputPath = path.join(DIAGRAMS_DIR, withSuffix(diagram.outputBase, suffix));

    runOrExit("d2", [inputPath, outputPath]);
  }
} finally {
  if (generatedPuppeteerDir) {
    rmSync(generatedPuppeteerDir, { recursive: true, force: true });
  }
}
