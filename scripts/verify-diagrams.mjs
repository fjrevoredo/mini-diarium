import { existsSync } from "node:fs";
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

let missing = 0;

for (const base of DIAGRAM_BASENAMES) {
  const svgPath = path.join(DIAGRAMS_DIR, `${base}.svg`);
  if (!existsSync(svgPath)) {
    console.error(`❌ Diagram missing: ${path.relative(process.cwd(), svgPath)}`);
    console.error("Run: bun run diagrams && commit the generated SVGs");
    missing = 1;
  }
}

if (missing !== 0) {
  process.exit(1);
}

console.log("✅ All diagrams present");
