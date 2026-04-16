import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DIAGRAMS_DIR = path.resolve("docs/diagrams");
const HASH_FILE = path.join(DIAGRAMS_DIR, ".source-hashes.json");

if (!existsSync(HASH_FILE)) {
  console.error("❌ docs/diagrams/.source-hashes.json missing.");
  console.error("Run: bun run diagrams && git add docs/diagrams/ && git commit");
  process.exit(1);
}

const storedHashes = JSON.parse(readFileSync(HASH_FILE, "utf8"));

let stale = false;
for (const [source, storedHash] of Object.entries(storedHashes)) {
  const sourcePath = path.join(DIAGRAMS_DIR, source);
  if (!existsSync(sourcePath)) {
    console.error(`❌ Source file missing: docs/diagrams/${source}`);
    stale = true;
    continue;
  }
  const currentHash = createHash("sha256").update(readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n")).digest("hex");
  if (currentHash !== storedHash) {
    console.error(`❌ Diagram source changed without regenerating: docs/diagrams/${source}`);
    stale = true;
  }
}

if (stale) {
  console.error("Run: bun run diagrams && git add docs/diagrams/ && git commit");
  process.exit(1);
}

console.log("✅ All diagrams up to date");
