#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const [lockfilePath, outputPath, npmCachePath] = process.argv.slice(2);

if (!lockfilePath || !outputPath || !npmCachePath) {
  console.error('Usage: node generate-node-sources.mjs <package-lock.json> <output.json> <npm-cache-dir>');
  process.exit(1);
}

const archMap = new Map([
  ['@esbuild/linux-arm', 'arm'],
  ['@esbuild/linux-arm64', 'aarch64'],
  ['@esbuild/linux-ia32', 'i386'],
  ['@esbuild/linux-x64', 'x86_64'],
]);

function decodeIntegrity(integrity) {
  const [algorithm, base64] = integrity.split('-', 2);
  if (!algorithm || !base64) {
    throw new Error(`Unsupported integrity format: ${integrity}`);
  }

  return {
    algorithm,
    hex: Buffer.from(base64, 'base64').toString('hex'),
  };
}

function getIndexRecord(npmCachePathValue, key, resolved, integrity, contentSize) {
  const sha1 = crypto.createHash('sha1').update(key).digest('hex');
  const filePath = path.join(
    npmCachePathValue,
    '_cacache',
    'index-v5',
    sha1.slice(0, 2),
    sha1.slice(2, 4),
    sha1.slice(4),
  );

  if (fs.existsSync(filePath)) {
    const contents = fs.readFileSync(filePath, 'utf8');
    const lines = contents.trim().split('\n');
    const needle = `"key":"${key}"`;
    const match = lines.findLast((line) => line.includes(needle));
    if (match) {
      return { sha1, contents: match };
    }
  }

  const json = JSON.stringify({
    key,
    integrity,
    time: 0,
    size: contentSize,
    metadata: {
      url: resolved,
      reqHeaders: {},
      resHeaders: {},
    },
  });
  const entryHash = crypto.createHash('sha1').update(json).digest('hex');

  return { sha1, contents: `${entryHash}\t${json}` };
}

function getContentSizeFromUrl(url, redirectCount = 0, method = 'HEAD') {
  if (redirectCount > 10) {
    return Promise.reject(new Error(`Too many redirects while fetching headers for ${url}`));
  }

  return new Promise((resolve, reject) => {
    const request = https.request(url, { method }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        resolve(getContentSizeFromUrl(nextUrl, redirectCount + 1, method));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Unexpected status ${statusCode} while fetching headers for ${url}`));
        return;
      }

      const contentLength = response.headers['content-length'];
      if (contentLength) {
        response.resume();
        const size = Number.parseInt(contentLength, 10);
        if (!Number.isFinite(size) || size < 0) {
          reject(new Error(`Invalid content-length ${contentLength} for ${url}`));
          return;
        }

        resolve(size);
        return;
      }

      if (method === 'HEAD') {
        response.resume();
        resolve(getContentSizeFromUrl(url, redirectCount, 'GET'));
        return;
      }

      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
      });
      response.on('end', () => {
        resolve(size);
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

async function getContentSize(item, contentFilePath, sizeCache) {
  if (fs.existsSync(contentFilePath)) {
    return fs.statSync(contentFilePath).size;
  }

  if (!sizeCache.has(item.resolved)) {
    sizeCache.set(item.resolved, getContentSizeFromUrl(item.resolved));
  }

  return sizeCache.get(item.resolved);
}

function buildMinimalPackument(packageName, pkg) {
  const versionData = {
    name: packageName,
    version: pkg.version,
    dist: { tarball: pkg.resolved, integrity: pkg.integrity },
  };
  if (pkg.dependencies) versionData.dependencies = pkg.dependencies;
  if (pkg.peerDependencies) versionData.peerDependencies = pkg.peerDependencies;
  if (pkg.peerDependenciesMeta) versionData.peerDependenciesMeta = pkg.peerDependenciesMeta;
  if (pkg.optionalDependencies) versionData.optionalDependencies = pkg.optionalDependencies;

  return JSON.stringify({
    name: packageName,
    'dist-tags': { latest: pkg.version },
    versions: { [pkg.version]: versionData },
  });
}

// Builds one line of a cacache index-v5 bucket file for a given accept header.
// cacache hashes the cache key with SHA-256 to derive the bucket file path, then
// each line in that file is: <sha1-of-json>\t<json>.
// npm/pacote fetches packuments with two distinct accept headers depending on the
// caller (corgiDoc for install/ci, fullDoc for view/audit), so we pre-populate
// both to ensure the entry satisfies whichever request npm makes.
function buildPackumentIndexLine(key, packumentUrl, integrity, byteLength, acceptHeader) {
  const json = JSON.stringify({
    key,
    integrity,
    time: 0,
    size: byteLength,
    metadata: { url: packumentUrl, reqHeaders: { accept: acceptHeader }, resHeaders: {} },
  });
  // SHA-1 is required by the cacache index-v5 format: each line is <sha1-of-json>\t<json>.
  // This is not a security hash — it is the cacache integrity marker for index line parsing.
  return `${crypto.createHash('sha1').update(json).digest('hex')}\t${json}`; // NOSONAR (S4790) — cacache internal format, not cryptographic security
}

const lock = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
const packages = lock.packages ?? {};

const normalEntries = new Map();
const esbuildEntries = new Map();

for (const [pkgPath, pkg] of Object.entries(packages)) {
  if (!pkgPath.startsWith('node_modules/')) {
    continue;
  }

  const resolved = pkg.resolved;
  const integrity = pkg.integrity;
  if (!resolved || !integrity) {
    continue;
  }

  const packageName = pkgPath.slice('node_modules/'.length);
  const key = `${resolved} ${integrity}`;
  const item = {
    packageName,
    version: pkg.version,
    resolved,
    integrity,
  };

  if (archMap.has(packageName)) {
    esbuildEntries.set(packageName, item);
  } else if (!normalEntries.has(key)) {
    normalEntries.set(key, item);
  }
}

const sources = [];
const sizeCache = new Map();

for (const packageName of archMap.keys()) {
  const item = esbuildEntries.get(packageName);
  if (!item) {
    continue;
  }

  const decoded = decodeIntegrity(item.integrity);
  if (decoded.algorithm !== 'sha512') {
    throw new Error(`Unexpected integrity algorithm for ${packageName}: ${decoded.algorithm}`);
  }

  sources.push({
    type: 'archive',
    url: item.resolved,
    'strip-components': 1,
    sha512: decoded.hex,
    dest: `flatpak-node/cache/esbuild/.package/${packageName}@${item.version}`,
    'only-arches': [archMap.get(packageName)],
  });
}

for (const item of normalEntries.values()) {
  const decoded = decodeIntegrity(item.integrity);
  if (decoded.algorithm !== 'sha512') {
    throw new Error(`Unexpected integrity algorithm for ${item.packageName}: ${decoded.algorithm}`);
  }

  const key = `make-fetch-happen:request-cache:${item.resolved}`;
  const contentFilePath = path.join(
    npmCachePath,
    '_cacache',
    'content-v2',
    'sha512',
    decoded.hex.slice(0, 2),
    decoded.hex.slice(2, 4),
    decoded.hex.slice(4),
  );
  const contentSize = await getContentSize(item, contentFilePath, sizeCache);
  const index = getIndexRecord(npmCachePath, key, item.resolved, item.integrity, contentSize);

  sources.push({
    type: 'file',
    url: item.resolved,
    sha512: decoded.hex,
    'dest-filename': decoded.hex.slice(4),
    dest: `flatpak-node/npm-cache/_cacache/content-v2/sha512/${decoded.hex.slice(0, 2)}/${decoded.hex.slice(2, 4)}`,
  });

  sources.push({
    type: 'inline',
    contents: index.contents,
    'dest-filename': index.sha1.slice(4),
    dest: `flatpak-node/npm-cache/_cacache/index-v5/${index.sha1.slice(0, 2)}/${index.sha1.slice(2, 4)}`,
  });
}

// Build set of all installed package names (for unresolved-optional-peer detection)
const installedPackageNames = new Set(
  Object.keys(packages)
    .filter((p) => p.startsWith('node_modules/'))
    .map((p) => p.slice('node_modules/'.length)),
);

for (const [pkgPath, pkg] of Object.entries(packages)) {
  if (!pkgPath.startsWith('node_modules/')) continue;
  if (!pkg.peerDependenciesMeta) continue;
  if (!pkg.resolved || !pkg.version) continue;

  // Only cache packuments for packages that have at least one optional peer dep
  // that is NOT present in the lockfile's node_modules tree.
  const hasUnresolvedOptional = Object.entries(pkg.peerDependenciesMeta).some(
    ([peer, meta]) => meta.optional && !installedPackageNames.has(peer),
  );
  if (!hasUnresolvedOptional) continue;

  const packageName = pkgPath.slice('node_modules/'.length);
  const packumentJson = buildMinimalPackument(packageName, pkg);
  const sha512Hex = crypto.createHash('sha512').update(packumentJson).digest('hex');
  const packumentIntegrity = `sha512-${Buffer.from(sha512Hex, 'hex').toString('base64')}`;

  // Scoped packages use lowercase %2f in the packument URL (e.g. @vitest%2fcoverage-v8).
  const encodedName = packageName.startsWith('@')
    ? packageName.replaceAll('/', '%2f')
    : packageName;
  const packumentUrl = `https://registry.npmjs.org/${encodedName}`;

  // Content entry — synthetic packument JSON stored by its sha512 hash
  sources.push({
    type: 'inline',
    contents: packumentJson,
    'dest-filename': sha512Hex.slice(4),
    dest: `flatpak-node/npm-cache/_cacache/content-v2/sha512/${sha512Hex.slice(0, 2)}/${sha512Hex.slice(2, 4)}`,
  });

  // Index entry — one cacache bucket file containing two lines: one per accept
  // header variant. cacache uses SHA-256 of the cache key for the bucket path.
  const key = `make-fetch-happen:request-cache:${packumentUrl}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const byteLength = Buffer.byteLength(packumentJson);
  const CORGI = 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*';
  const FULL = 'application/json';
  const indexContents = [
    buildPackumentIndexLine(key, packumentUrl, packumentIntegrity, byteLength, CORGI),
    buildPackumentIndexLine(key, packumentUrl, packumentIntegrity, byteLength, FULL),
  ].join('\n');
  sources.push({
    type: 'inline',
    contents: indexContents,
    'dest-filename': keyHash.slice(4),
    dest: `flatpak-node/npm-cache/_cacache/index-v5/${keyHash.slice(0, 2)}/${keyHash.slice(2, 4)}`,
  });
}

sources.push({
  type: 'script',
  commands: [
    'version=$(node --version | sed "s/^v//")',
    'nodedir=$(dirname "$(dirname "$(which node)")")',
    'mkdir -p "flatpak-node/cache/node-gyp/$version"',
    'ln -s "$nodedir/include" "flatpak-node/cache/node-gyp/$version/include"',
    'echo 11 > "flatpak-node/cache/node-gyp/$version/installVersion"',
  ],
  'dest-filename': 'setup_sdk_node_headers.sh',
  dest: 'flatpak-node',
});

sources.push({
  type: 'shell',
  commands: ['bash flatpak-node/setup_sdk_node_headers.sh'],
});

for (const [packageName, onlyArch] of archMap.entries()) {
  const item = esbuildEntries.get(packageName);
  if (!item) {
    continue;
  }

  const suffix = packageName.split('/')[1];
  sources.push({
    type: 'shell',
    commands: [
      'mkdir -p "bin/@esbuild"',
      `cp ".package/${packageName}@${item.version}/bin/esbuild" "bin/${packageName}@${item.version}"`,
      `ln -sf "@esbuild/${suffix}@${item.version}" "bin/esbuild-current"`,
    ],
    dest: 'flatpak-node/cache/esbuild',
    'only-arches': [onlyArch],
  });
}

fs.writeFileSync(outputPath, `${JSON.stringify(sources, null, 4)}\n`);
