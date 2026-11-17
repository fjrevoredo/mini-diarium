import { readFileSync, writeFileSync } from 'node:fs';

const [version, path] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Expected version X.Y.Z');
const html = readFileSync(path, 'utf8');
const links = [...html.matchAll(/href=["']([^"']*\/releases\/(?:latest\/download|download\/[^/]+)\/Mini-Diarium-[^"']*)["']/g)];
const pattern = /^https:\/\/github\.com\/fjrevoredo\/mini-diarium\/releases\/(?:latest\/download|download\/v(\d+\.\d+\.\d+))\/Mini-Diarium-(\d+\.\d+\.\d+)-(windows\.exe|macos\.dmg|linux\.AppImage)$/;
const parsed = links.map((link) => link[1].match(pattern));
if (links.length !== 3 || parsed.some((match) => !match || (match[1] && match[1] !== match[2])) || new Set(parsed.map((match) => match[3])).size !== 3) {
  throw new Error('Expected three valid download URLs with matching tag and filename versions.');
}
let updated = html;
for (let i = 0; i < links.length; i++) {
  updated = updated.replace(links[i][1], `https://github.com/fjrevoredo/mini-diarium/releases/download/v${version}/Mini-Diarium-${version}-${parsed[i][3]}`);
}
writeFileSync(path, updated);
