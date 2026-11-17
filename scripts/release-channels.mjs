import { pathToFileURL } from 'node:url';
import { json, run, report } from './release-lib.mjs';

export function storeState(runResult, log) {
  if (!runResult) return 'awaiting maintainer';
  if (runResult.status !== 'completed') return 'submitted / awaiting external review';
  if (runResult.conclusion !== 'success') return 'failed';
  return /submission(?:\s+created\.)?\s*(?:id|identifier)\s*[:=]\s*['"]?\d+/i.test(log) ? 'submitted / awaiting external review' : 'awaiting maintainer';
}

export function prState(pr, availableWhenMerged = false) {
  if (!pr) return 'awaiting maintainer';
  if (pr.mergedAt) return availableWhenMerged ? 'available' : 'submitted / awaiting external review';
  return pr.state === 'OPEN' ? 'submitted / awaiting external review' : 'failed';
}

export function runTag(log) {
  const tags = log.split(/\r?\n/).map((line) => line.match(/\bRELEASE_AUTOMATION_TAG=(v\d+\.\d+\.\d+)\s*$/)?.[1]).filter(Boolean);
  return tags.length && tags.every((tag) => tag === tags[0]) ? tags[0] : null;
}

export function runDetail(item) {
  if (item.status !== 'completed') return `submitted / awaiting external review run ${item.databaseId}`;
  return `${item.conclusion === 'success' ? 'completed' : 'failed'}: run ${item.databaseId}: ${item.conclusion}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: release-channels.mjs --version X.Y.Z [--json]'); return; }
  const version = args[args.indexOf('--version') + 1];
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('A version X.Y.Z is required');
  const tag = `v${version}`;
  const results = [];
  const add = (name, detail) => results.push({ name, ok: !detail.startsWith('failed'), detail });
  const attempt = async (name, fn) => { try { add(name, await fn()); } catch (error) { results.push({ name, ok: false, detail: `failed: ${error.message.split('\n')[0]}` }); } };
  const findRun = (workflow) => {
    const runs = json('gh', ['run', 'list', '--workflow', workflow, '--event', 'workflow_dispatch', '--branch', 'master', '--limit', '100', '--json', 'databaseId,status,conclusion']);
    let unresolved = false;
    for (const item of runs) {
      if (item.status !== 'completed') { unresolved = true; continue; }
      let log; try { log = run('gh', ['run', 'view', String(item.databaseId), '--log']); } catch { unresolved = true; continue; }
      const observed = runTag(log);
      if (observed === tag) {
        if (unresolved) throw new Error('a newer dispatch run could not be inspected; tag association is unknown');
        return { item, log };
      }
      if (!observed) unresolved = true;
    }
    if (unresolved) throw new Error('one or more dispatch runs could not be inspected; tag association is unknown');
    return null;
  };
  await attempt('Homebrew', () => {
    const cask = run('gh', ['api', 'repos/fjrevoredo/homebrew-mini-diarium/contents/Casks/mini-diarium.rb', '--jq', '.content']);
    const body = Buffer.from(cask.replace(/\s/g, ''), 'base64').toString('utf8');
    const checksum = run('gh', ['release', 'download', tag, '--pattern', 'checksums-macos.txt', '--output', '-']);
    const hash = checksum.match(/^([a-f0-9]{64})\s+\*?Mini-Diarium-[^\s]+-macos\.dmg/m)?.[1];
    return body.includes(`version "${version}"`) && hash && body.includes(hash) ? 'available' : 'awaiting maintainer';
  });
  await attempt('WinGet', () => {
    const prs = json('gh', ['pr', 'list', '--repo', 'microsoft/winget-pkgs', '--state', 'all', '--search', `"${version}" "fjrevoredo.MiniDiarium"`, '--limit', '100', '--json', 'title,state,mergedAt,url']);
    const pr = prs.find((item) => item.title.includes(version) && /mini.?diarium/i.test(item.title));
    return `${prState(pr, true)}${pr ? ` ${pr.url}` : ''}`;
  });
  await attempt('Flathub', async () => {
    const prs = json('gh', ['pr', 'list', '--repo', 'flathub/io.github.fjrevoredo.mini-diarium', '--state', 'all', '--search', version, '--limit', '100', '--json', 'title,state,mergedAt,url']);
    const pr = prs.find((item) => item.title.includes(version));
    if (!pr?.mergedAt) return `${pr?.state === 'OPEN' ? 'awaiting maintainer' : prState(pr)}${pr ? ` ${pr.url}` : ''}`;
    const response = await fetch('https://flathub.org/api/v2/appstream/io.github.fjrevoredo.mini-diarium');
    if (!response.ok) throw new Error(`Flathub HTTP ${response.status}`);
    const data = await response.json();
    return `${JSON.stringify(data.releases ?? []).includes(`"${version}"`) ? 'available' : 'submitted / awaiting external review'} ${pr.url}`;
  });
  await attempt('Store', () => { const found = findRun('msstore-publish.yml'); return `${storeState(found?.item, found?.log ?? '')}${found ? ` run ${found.item.databaseId}` : ''}`; });
  for (const [name, workflow] of [['Homebrew run', 'homebrew-cask.yml'], ['WinGet run', 'winget-publish.yml'], ['Flathub run', 'flathub-publish.yml']]) await attempt(name, () => { const found = findRun(workflow); return found ? runDetail(found.item) : 'awaiting maintainer: no matching run found'; });
  await attempt('cleanup PR', () => { const prs = json('gh', ['pr', 'list', '--state', 'all', '--search', `"clear latest changelog after ${tag}"`, '--json', 'title,url,state']); const pr = prs.find((item) => item.title.includes(tag)); return pr ? `${pr.state} ${pr.url}` : 'awaiting maintainer: not found'; });
  report(results, args.includes('--json'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
