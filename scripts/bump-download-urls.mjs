import { readFileSync, writeFileSync } from 'node:fs';

const [version, path] = process.argv.slice(2);
const html = readFileSync(path, 'utf8');
const pattern = /releases\/(?:latest\/download|download\/v(\d+\.\d+\.\d+))\/Mini-Diarium-(\d+\.\d+\.\d+)-(windows\.exe|macos\.dmg|linux\.AppImage)/g;
const matches = [...html.matchAll(pattern)];
const platforms = new Set(matches.map((match) => match[3]));
const allAssets = html.match(/releases\/(?:latest\/download|download\/[^/]+)\/Mini-Diarium-[^"'\s<]+/g) ?? [];
if (allAssets.length !== 3 || matches.length !== 3 || platforms.size !== 3 || matches.some((match) => match[1] && match[1] !== match[2])) {
  console.error('Expected three valid download URLs with matching tag and filename versions.');
  process.exit(1);
}
const updated = html.replace(pattern, (_match, _tag, _file, platform) =>
  `releases/download/v${version}/Mini-Diarium-${version}-${platform}`,
);
writeFileSync(path, updated);
