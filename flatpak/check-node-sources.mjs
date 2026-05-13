#!/usr/bin/env node
import fs from 'node:fs';

const [lockfilePath, sourcesPath] = process.argv.slice(2);

if (!lockfilePath || !sourcesPath) {
  console.error('Usage: node check-node-sources.mjs <package-lock.json> <node-sources.json>');
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    process.exit(2);
  }
}

const lock = readJson(lockfilePath);
const sources = readJson(sourcesPath);

const sourceUrls = new Set();
for (const entry of sources) {
  if (entry.url) {
    sourceUrls.add(entry.url);
  }
}

const packages = lock.packages ?? {};
const missing = [];

for (const [pkgPath, pkg] of Object.entries(packages)) {
  if (!pkgPath.startsWith('node_modules/')) continue;
  if (!pkg.resolved || !pkg.integrity) continue;
  if (!sourceUrls.has(pkg.resolved)) {
    missing.push({ name: pkgPath.slice('node_modules/'.length), version: pkg.version ?? '?', resolved: pkg.resolved });
  }
}

// Validate ordering: all shell/script entries MUST come after all archive entries.
// flatpak-builder processes entries sequentially; a shell cp that runs before
// its archive is extracted will fail with "No such file or directory".
let lastArchiveIndex = -1;
let firstShellIndex = -1;
for (let i = 0; i < sources.length; i++) {
  const e = sources[i];
  if (e.type === 'archive') lastArchiveIndex = i;
  if ((e.type === 'shell' || e.type === 'script') && firstShellIndex === -1) firstShellIndex = i;
}
const orderingOk = firstShellIndex === -1 || lastArchiveIndex === -1 || lastArchiveIndex < firstShellIndex;

let exitCode = 0;

if (!orderingOk) {
  console.error(`ORDERING ERROR: shell/script entry at index ${firstShellIndex} appears before last archive at index ${lastArchiveIndex}.`);
  console.error('flatpak-builder processes entries sequentially — shell commands must come after all archive extractions.');
  console.error('Move all shell/script entries to the end of the file.');
  exitCode = 1;
}

if (missing.length > 0) {
  console.error(`${missing.length} package(s) missing from node-sources.json:`);
  for (const m of missing) {
    console.error(`  ${m.name}@${m.version}  ${m.resolved}`);
  }
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('All packages accounted for and ordering is correct.');
}
process.exit(exitCode);
