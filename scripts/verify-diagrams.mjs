import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const DIAGRAMS_DIR = path.resolve("docs/diagrams");
const DIAGRAM_BASENAMES = [
  "unlock",
  "unlock-dark",
  "save-entry",
  "save-entry-dark",
  "context",
  "context-dark",
  "architecture",
  "architecture-dark",
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

const suffix = getArgValue("--suffix", "-check");
const keepGenerated = process.argv.includes("--keep-generated");

let mismatches = 0;

try {
  for (const base of DIAGRAM_BASENAMES) {
    const committedPath = path.join(DIAGRAMS_DIR, `${base}.svg`);
    const generatedPath = path.join(DIAGRAMS_DIR, `${base}${suffix}.svg`);

    if (!existsSync(committedPath)) {
      console.error(`❌ Diagram missing: ${path.relative(process.cwd(), committedPath)}`);
      console.error("Run: bun run diagrams");
      mismatches = 1;
      continue;
    }

    if (!existsSync(generatedPath)) {
      console.error(`❌ Diagram missing: ${path.relative(process.cwd(), generatedPath)}`);
      console.error("Run: bun run diagrams");
      mismatches = 1;
      continue;
    }

    const committedBuffer = readFileSync(committedPath);
    const generatedBuffer = readFileSync(generatedPath);

    if (!committedBuffer.equals(generatedBuffer)) {
      console.error(`❌ Diagram out of date: ${path.relative(process.cwd(), committedPath)}`);
      console.error(`   Regenerated: ${path.relative(process.cwd(), generatedPath)}`);
      console.error(
        `   Size (committed/generated): ${committedBuffer.byteLength} / ${generatedBuffer.byteLength} bytes`,
      );
      mismatches = 1;
    }
  }

  if (mismatches !== 0) {
    console.error("Run: bun run diagrams && commit updated SVGs");
    process.exit(1);
  }

  console.log("✅ All diagrams are up-to-date");
} finally {
  if (!keepGenerated && suffix) {
    for (const base of DIAGRAM_BASENAMES) {
      const generatedPath = path.join(DIAGRAMS_DIR, `${base}${suffix}.svg`);
      rmSync(generatedPath, { force: true });
    }
  }
}
