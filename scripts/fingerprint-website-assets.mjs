import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WEBSITE_DIR = path.join(ROOT_DIR, "website");

const ASSETS = [
  {
    dir: "css",
    base: "style",
    ext: "css",
    htmlPattern: /href="\/?css\/style(?:\.[0-9a-f]{8})?\.css"/g,
    htmlAttr: "href",
  },
  {
    dir: "js",
    base: "main",
    ext: "js",
    htmlPattern: /src="\/?js\/main(?:\.[0-9a-f]{8})?\.js"/g,
    htmlAttr: "src",
  },
];

/**
 * Hashes text content with line endings normalized to LF, so the fingerprint is a
 * function of the content and not of which platform checked the repo out. Windows
 * checkouts materialize these sources as CRLF unless `.gitattributes` pins them,
 * and an un-normalized hash rotates every generated HTML file on every platform
 * switch. Mirrors the same `\r\n` stripping in scripts/render-diagrams.mjs.
 */
function shortHash(content) {
  const text = Buffer.isBuffer(content) ? content.toString("utf8") : String(content);
  return createHash("sha256")
    .update(text.replace(/\r\n/g, "\n"), "utf8")
    .digest("hex")
    .slice(0, 8);
}

/** Reads a file as LF-normalized bytes — the exact bytes `shortHash` sees. */
function readNormalized(filePath) {
  return Buffer.from(readFileSync(filePath, "utf8").replace(/\r\n/g, "\n"), "utf8");
}

function assertReplacement(content, asset, replacement) {
  // Existence check needs its own non-global copy: sharing the /g regex object
  // between .test() and .replace() carries `lastIndex` state across files.
  if (!new RegExp(asset.htmlPattern.source).test(content)) {
    throw new Error(`Could not find expected pattern for replacement: ${asset.htmlPattern}`);
  }
  return content.replace(asset.htmlPattern, replacement);
}

/**
 * Rewrites every fingerprinted asset reference in `html`. `hashesByBase` maps each
 * asset's base name (`style`, `main`) to its short hash. Idempotent: the patterns
 * match both the bare and the already-fingerprinted form.
 */
function rewriteAssetReferences(html, hashesByBase) {
  let output = html;

  for (const asset of ASSETS) {
    const hash = hashesByBase[asset.base];

    if (!hash) {
      throw new Error(`Missing fingerprint for asset: ${asset.base}`);
    }

    output = assertReplacement(
      output,
      asset,
      `${asset.htmlAttr}="/${asset.dir}/${asset.base}.${hash}.${asset.ext}"`,
    );
  }

  return output;
}

/**
 * Windows AV / Search indexer can briefly hold a handle on a freshly written file,
 * surfacing as errno -4094 (UNKNOWN). Every observed failure cleared on retry.
 */
async function writeWithRetry(targetPath, data, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      writeFileSync(targetPath, data);
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await sleep(50 * attempt);
    }
  }
}

/** Skips the write entirely when the target already holds these exact bytes. */
async function writeIfChanged(targetPath, data) {
  if (existsSync(targetPath) && readFileSync(targetPath).equals(data)) {
    return false;
  }

  await writeWithRetry(targetPath, data);
  return true;
}

function walkHtmlFiles(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(dirPath)) {
    const entryPath = path.join(dirPath, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      files.push(...walkHtmlFiles(entryPath));
      continue;
    }

    if (entry.endsWith(".html")) {
      files.push(entryPath);
    }
  }

  return files;
}

async function main() {
  const htmlFiles = walkHtmlFiles(WEBSITE_DIR);

  if (htmlFiles.length === 0) {
    throw new Error("No HTML files found under website/");
  }

  const hashesByBase = {};

  for (const asset of ASSETS) {
    const sourceDir = path.join(WEBSITE_DIR, asset.dir);
    const sourcePath = path.join(sourceDir, `${asset.base}.${asset.ext}`);
    const sourceContent = readNormalized(sourcePath);
    const hash = shortHash(sourceContent);
    const hashedFilename = `${asset.base}.${hash}.${asset.ext}`;
    const stalePattern = new RegExp(`^${asset.base}\\.[0-9a-f]{8}\\.${asset.ext}$`);

    hashesByBase[asset.base] = hash;

    for (const fileName of readdirSync(sourceDir)) {
      if (stalePattern.test(fileName) && fileName !== hashedFilename) {
        unlinkSync(path.join(sourceDir, fileName));
        console.log(`Removed stale fingerprint: ${asset.dir}/${fileName}`);
      }
    }

    // Write the normalized bytes that were hashed, so the name always matches the content.
    if (await writeIfChanged(path.join(sourceDir, hashedFilename), sourceContent)) {
      console.log(`Fingerprint updated: ${asset.dir}/${hashedFilename}`);
    } else {
      console.log(`Fingerprint unchanged: ${asset.dir}/${hashedFilename}`);
    }
  }

  let updated = 0;
  let unchanged = 0;

  for (const htmlPath of htmlFiles) {
    const rewritten = rewriteAssetReferences(readFileSync(htmlPath, "utf8"), hashesByBase);

    if (await writeIfChanged(htmlPath, Buffer.from(rewritten, "utf8"))) {
      updated += 1;
      console.log(`Updated asset references: ${path.relative(WEBSITE_DIR, htmlPath)}`);
    } else {
      unchanged += 1;
    }
  }

  console.log(`Asset references: ${updated} updated / ${unchanged} unchanged`);
}

export { ASSETS, readNormalized, rewriteAssetReferences, shortHash };

// Windows argv[1] can differ from import.meta.url only by drive-letter case.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isDirectRun =
  invokedPath === __filename ||
  (process.platform === "win32" && invokedPath.toLowerCase() === __filename.toLowerCase());

if (isDirectRun) {
  await main();
}
