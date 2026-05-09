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

if (missing.length === 0) {
  console.log('All packages accounted for.');
  process.exit(0);
}

console.log(`${missing.length} package(s) missing from node-sources.json:`);
for (const m of missing) {
  console.log(`  ${m.name}@${m.version}  ${m.resolved}`);
}
process.exit(1);
