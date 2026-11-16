import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { json, run } from './release-lib.mjs';

export function classify(runs, sha, log = '') {
  const found = runs.find((item) => item.headSha === sha);
  if (!found) return { state: 'no run' };
  if (found.status !== 'completed') return { state: 'running', id: found.databaseId };
  if (found.conclusion === 'success') return { state: 'green', id: found.databaseId };
  const hash = log.match(/npmDepsHash is stale\. Set it to (sha256-[A-Za-z0-9+/=]+)/)?.[1];
  return hash ? { state: 'stale-hash', hash, id: found.databaseId } : { state: 'real failure', id: found.databaseId };
}

export function applyHash(source, hash) {
  const pattern = /npmDepsHash\s*=\s*"[^"]+";/g;
  if ([...source.matchAll(pattern)].length !== 1 || !/^sha256-[A-Za-z0-9+/=]+$/.test(hash)) throw new Error('Cannot safely replace npmDepsHash');
  return source.replace(pattern, `npmDepsHash = "${hash}";`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: release-nix-hash.mjs --sha SHA [--apply] [--json]'); process.exit(0); }
  const sha = args[args.indexOf('--sha') + 1];
  if (!/^[a-f0-9]{40}$/i.test(sha ?? '')) throw new Error('A full commit SHA is required');
  const runs = json('gh', ['run', 'list', '--workflow', 'nix.yml', '--event', 'push', '--commit', sha, '--limit', '100', '--json', 'headSha,status,conclusion,databaseId']);
  let result = classify(runs, sha);
  if (result.state === 'real failure') {
    const log = run('gh', ['run', 'view', String(result.id), '--log']);
    result = classify(runs, sha, log);
  }
  if (args.includes('--apply')) {
    if (result.state !== 'stale-hash') throw new Error('Refusing to apply without a stale-hash result');
    const path = 'nix/package.nix';
    writeFileSync(path, applyHash(readFileSync(path, 'utf8'), result.hash));
  }
  console.log(args.includes('--json') ? JSON.stringify(result) : `Nix: ${result.state}${result.hash ? ` (${result.hash})` : ''}${result.id ? ` run ${result.id}` : ''}`);
  if (result.state !== 'green') process.exitCode = 1;
}
