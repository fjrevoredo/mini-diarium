import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { json, run, report } from './release-lib.mjs';

export function expectedAssets(version) {
  return ['windows.exe', 'windows.msi', 'macos.dmg', 'linux.AppImage', 'linux.deb'].map((suffix) => `Mini-Diarium-${version}-${suffix}`);
}

export function verifyChecksum(text, filename, bytes) {
  const entry = text.split(/\r?\n/).find((line) => line.trim().endsWith(` ${filename}`) || line.trim().endsWith(` *${filename}`));
  const expected = entry?.match(/^([a-f0-9]{64})\s/i)?.[1].toLowerCase();
  return !!expected && createHash('sha256').update(bytes).digest('hex') === expected;
}

export function pageLinks(html, version) {
  const urls = [...html.matchAll(/href="(https:\/\/github\.com\/fjrevoredo\/mini-diarium\/releases\/[^" ]+Mini-Diarium-[^" ]+)"/g)].map((m) => m[1]);
  return urls.length === 3 && ['windows.exe', 'macos.dmg', 'linux.AppImage'].every((suffix) => urls.includes(`https://github.com/fjrevoredo/mini-diarium/releases/download/v${version}/Mini-Diarium-${version}-${suffix}`));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: release-verify.mjs --version X.Y.Z [--live-site] [--json]'); return; }
  const version = args[args.indexOf('--version') + 1];
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('A version X.Y.Z is required');
  const results = [];
  const check = async (name, fn) => { try { results.push({ name, ok: true, detail: String(await fn() ?? 'OK') }); } catch (error) { results.push({ name, ok: false, detail: error.message }); } };
  const requireValue = (value, message) => { if (!value) throw new Error(message); };
  const tag = `v${version}`;
  let release;
  await check('release', () => { release = json('gh', ['api', `repos/fjrevoredo/mini-diarium/releases/tags/${tag}`]); requireValue(!release.draft && !release.prerelease, 'release is not published'); return release.html_url; });
  await check('assets and checksums', () => {
    requireValue(release, 'release unavailable');
    const installers = expectedAssets(version);
    const checksums = ['checksums-linux.txt', 'checksums-macos.txt', 'checksums-windows.txt'];
    for (const name of [...installers, ...checksums]) requireValue(release.assets.some((a) => a.name === name && a.size > 0), `missing or empty ${name}`);
    const dir = mkdtempSync(join(tmpdir(), 'fenmark-release-'));
    try {
      run('gh', ['release', 'download', tag, '--dir', dir, ...[...installers, ...checksums].flatMap((name) => ['--pattern', name])]);
      for (const name of installers) {
        const platform = name.includes('-windows.') ? 'windows' : name.includes('-macos.') ? 'macos' : 'linux';
        requireValue(verifyChecksum(readFileSync(join(dir, `checksums-${platform}.txt`), 'utf8'), name, readFileSync(join(dir, name))), `checksum mismatch: ${name}`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
    return 'five installers and three checksum files verified';
  });
  await check('release body', () => { requireValue(release, 'release unavailable'); requireValue(release.body.trimEnd() === run('git', ['show', `${tag}:latest-changelog.md`]).trimEnd(), 'body differs from tagged changelog'); });
  if (args.includes('--live-site')) {
    await check('website', async () => { const response = await fetch('https://fenmark.app/'); const html = await response.text(); requireValue(response.status === 200 && html.includes(`<span class="app-version">${version}</span>`) && pageLinks(html, version), 'version or pinned links differ'); for (const suffix of ['windows.exe', 'macos.dmg', 'linux.AppImage']) { const r = await fetch(`https://github.com/fjrevoredo/mini-diarium/releases/download/${tag}/Mini-Diarium-${version}-${suffix}`, { redirect: 'manual' }); requireValue(r.status === 302, `${suffix} returned ${r.status}`); } });
    await check('canonical redirect', async () => { const r = await fetch('https://www.fenmark.app/', { redirect: 'manual' }); requireValue(r.status >= 300 && r.status < 400 && r.headers.get('location') === 'https://fenmark.app/', 'unexpected redirect'); });
    await check('legacy domain', async () => { const home = await fetch('https://mini-diarium.com/'); requireValue(home.status === 200 && (await home.text()).includes('https://fenmark.app/'), 'legacy transition page differs'); const deep = await fetch('https://mini-diarium.com/docs/', { redirect: 'manual' }); requireValue(deep.status === 301 && deep.headers.get('location') === 'https://fenmark.app/docs/', 'legacy deep link differs'); });
    const robots = await fetch('https://fenmark.app/robots.txt'); const body = await robots.text(); results.push({ name: 'robots Content-Signal (report)', ok: true, detail: /Content-Signal/i.test(body) ? 'present' : 'absent' });
  }
  report(results, args.includes('--json'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
