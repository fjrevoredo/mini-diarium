import { createHash } from "node:crypto";
import {
  copyFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WEBSITE_DIR = path.join(ROOT_DIR, "website");
const INDEX_PATH = path.join(WEBSITE_DIR, "index.html");

const ASSETS = [
  {
    dir: "css",
    base: "style",
    ext: "css",
    htmlPattern: /href="css\/style(?:\.[0-9a-f]{8})?\.css"/,
    htmlAttr: "href",
  },
  {
    dir: "js",
    base: "main",
    ext: "js",
    htmlPattern: /src="js\/main(?:\.[0-9a-f]{8})?\.js"/,
    htmlAttr: "src",
  },
];

function shortHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 8);
}

function assertReplacement(content, pattern, replacement) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find expected pattern for replacement: ${pattern}`);
  }
  return content.replace(pattern, replacement);
}

let html = readFileSync(INDEX_PATH, "utf8");

for (const asset of ASSETS) {
  const sourcePath = path.join(WEBSITE_DIR, asset.dir, `${asset.base}.${asset.ext}`);
  const sourceDir = path.dirname(sourcePath);
  const sourceContent = readFileSync(sourcePath);
  const hash = shortHash(sourceContent);
  const hashedFilename = `${asset.base}.${hash}.${asset.ext}`;
  const hashedPath = path.join(sourceDir, hashedFilename);
  const stalePattern = new RegExp(`^${asset.base}\\.[0-9a-f]{8}\\.${asset.ext}$`);

  for (const fileName of readdirSync(sourceDir)) {
    if (stalePattern.test(fileName) && fileName !== hashedFilename) {
      unlinkSync(path.join(sourceDir, fileName));
    }
  }

  copyFileSync(sourcePath, hashedPath);

  html = assertReplacement(
    html,
    asset.htmlPattern,
    `${asset.htmlAttr}="${asset.dir}/${hashedFilename}"`,
  );

  console.log(`Fingerprint updated: ${asset.dir}/${hashedFilename}`);
}

writeFileSync(INDEX_PATH, html);
console.log("Updated website/index.html references");
