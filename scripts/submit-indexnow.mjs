import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const DRY_RUN = process.argv.includes("--dry-run");
const SITE = "mini-diarium.com";
// Submit to both the generic endpoint (propagates to Yandex, Seznam, etc.)
// and Bing's direct endpoint (required for Bing Webmaster Tools to register submissions).
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/IndexNow",
  "https://www.bing.com/indexnow",
];

function findKeyFile() {
  const websiteDir = path.resolve(rootDir, "website");
  const entries = fs.readdirSync(websiteDir);
  const matches = entries.filter((f) => /^indexnow-key-[0-9a-f]+\.txt$/.test(f));
  if (matches.length === 0) {
    console.error("Error: No IndexNow key file found (expected website/indexnow-key-*.txt)");
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Error: Multiple IndexNow key files found: ${matches.join(", ")}`);
    console.error("Remove all but one key file before submitting.");
    process.exit(1);
  }
  return matches[0];
}

function readKey(keyFile) {
  const keyPath = path.resolve(rootDir, "website", keyFile);
  const raw = fs.readFileSync(keyPath, "utf8").trim();
  if (!/^[0-9a-f]{32}$/.test(raw)) {
    console.error(`Error: Key file contains an invalid key (expected 32-char hex, got "${raw}")`);
    process.exit(1);
  }
  return raw;
}

function extractUrls(sitemapPath) {
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  const urls = [];
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function buildPayload(key, keyFile, urls) {
  return {
    host: SITE,
    key,
    keyLocation: `https://${SITE}/${keyFile}`,
    urlList: urls,
  };
}

async function submit(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const status = response.status;
  const statusText = response.statusText;

  if (status === 200 || status === 202) {
    console.log(`  OK: HTTP ${status} ${statusText}`);
    return;
  }

  const body = await response.text().catch(() => "");
  console.error(`  Error: HTTP ${status} ${statusText}`);
  if (body) console.error(`  Response: ${body}`);

  switch (status) {
    case 400:
      console.error("  Bad request — invalid payload format.");
      break;
    case 403:
      console.error("  Forbidden — key file not found on domain or key mismatch.");
      break;
    case 422:
      console.error("  Unprocessable Entity — URLs do not match the declared host.");
      break;
    case 429:
      console.error("  Too Many Requests — rate limited. Try again later.");
      break;
    default:
      console.error(`  Unexpected response code: ${status}`);
  }

  process.exit(1);
}

async function main() {
  const keyFile = findKeyFile();
  const key = readKey(keyFile);
  const sitemapPath = path.resolve(rootDir, "website", "sitemap.xml");

  if (!fs.existsSync(sitemapPath)) {
    console.error(`Error: Sitemap not found at ${sitemapPath}`);
    console.error("Run 'bun run website:build-static' first.");
    process.exit(1);
  }

  const urls = extractUrls(sitemapPath);
  if (urls.length === 0) {
    console.error("Error: No URLs found in sitemap.xml");
    process.exit(1);
  }

  const payload = buildPayload(key, keyFile, urls);

  if (DRY_RUN) {
    console.log(`[Dry Run] Would submit ${urls.length} URLs to ${INDEXNOW_ENDPOINTS.length} endpoints:`);
    INDEXNOW_ENDPOINTS.forEach((ep) => console.log(`  - ${ep}`));
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Submitting ${urls.length} URLs to ${INDEXNOW_ENDPOINTS.length} endpoints...`);
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    console.log(`→ ${endpoint}`);
    await submit(endpoint, payload);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
