import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { run, json, unreleased, report, workflowState, missingSecrets, adminBypass } from './release-lib.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: release-preflight.mjs --version X.Y.Z [--json]');
  process.exit(0);
}
const version = args[args.indexOf('--version') + 1];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('A version X.Y.Z is required');
const results = [];
function check(name, fn) {
  try { const detail = fn(); results.push({ name, ok: true, detail: String(detail ?? 'OK') }); }
  catch (error) { results.push({ name, ok: false, detail: error.message.split('\n')[0] }); }
}
function requireValue(condition, message) { if (!condition) throw new Error(message); }
const gh = (...a) => run('gh', a);
const api = (path) => json('gh', ['api', path]);
const repo = 'fjrevoredo/mini-diarium';
let head;
check('working tree', () => { requireValue(!run('git', ['status', '--porcelain']), 'working tree is dirty'); });
check('branch', () => { requireValue(run('git', ['branch', '--show-current']) === 'master', 'branch is not master'); });
check('remote HEAD', () => { head = run('git', ['rev-parse', 'HEAD']); const remote = run('git', ['ls-remote', 'origin', 'refs/heads/master']).split(/\s+/)[0]; requireValue(head === remote, 'unpushed commits or remote divergence'); return head; });
check('changelog', () => { const entry = unreleased(readFileSync('CHANGELOG.md', 'utf8')); requireValue(entry?.version === version, 'first unreleased version does not match'); return entry.body; });
check('tags', () => { const local = run('git', ['tag', '--list', `v${version}`]); const remote = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/v${version}`]); requireValue(!local && !remote, 'tag already exists'); });
check('release', () => { const releases = json('gh', ['api', '--paginate', `repos/${repo}/releases`, '--slurp']).flat(); requireValue(!releases.some((r) => r.tag_name === `v${version}`), 'release already exists'); });
for (const workflow of ['ci.yml', 'nix.yml']) check(workflow, () => { const runs = json('gh', ['run', 'list', '--workflow', workflow, '--event', 'push', '--limit', '100', '--json', 'headSha,status,conclusion,databaseId']); const state = workflowState(runs, head, workflow === 'nix.yml'); requireValue(state === 'green' || state === 'absent', 'latest run for HEAD is missing or not green'); return state === 'absent' ? 'no run for HEAD' : `run ${runs.find((r) => r.headSha === head).databaseId}`; });
check('GitHub authentication', () => { gh('auth', 'status'); });
check('cargo audit', () => { run('cargo', ['audit']); });
check('secrets', () => { const required = ['WINGET_TOKEN','GH_PAT','FLATHUB_TOKEN','SIGNPATH_API_TOKEN','SIGNPATH_ORGANIZATION_ID','SIGNPATH_PROJECT_SLUG','SIGNPATH_SIGNING_POLICY_SLUG','PARTNER_CENTER_CLIENT_ID','PARTNER_CENTER_CLIENT_SECRET','PARTNER_CENTER_SELLER_ID','PARTNER_CENTER_TENANT_ID','MSSTORE_PRODUCT_ID']; const missing = missingSecrets(gh('secret', 'list'), required); requireValue(!missing.length, `missing: ${missing.join(', ')}`); });
check('push authority', () => {
  const remote = run('git', ['remote', 'get-url', '--push', 'origin']);
  let login;
  if (/^https:\/\/github\.com\//i.test(remote)) {
    const credentials = run('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' });
    login = credentials.match(/^username=(.+)$/m)?.[1];
  } else if (/^(?:git@github\.com:|ssh:\/\/git@github\.com\/)/i.test(remote)) {
    let configured = '';
    try { configured = run('git', ['config', '--get', 'core.sshCommand']); } catch { /* Git default */ }
    const command = process.env.GIT_SSH_COMMAND || configured || 'ssh';
    const result = spawnSync('sh', ['-c', `${command} -T git@github.com`], { encoding: 'utf8', timeout: 15000 });
    login = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.match(/Hi ([A-Za-z0-9-]+)!/i)?.[1];
  } else throw new Error('non-GitHub push principal is unverifiable');
  requireValue(login && login !== 'x-access-token', 'credential helper login is unverifiable');
  const permission = api(`repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`).permission;
  const rules = api(`repos/${repo}/rulesets`).filter((rule) => rule.enforcement === 'active' && rule.target === 'branch');
  requireValue(rules.length > 0, 'no active branch ruleset could be verified');
  for (const rule of rules) {
    const detail = api(`repos/${repo}/rulesets/${rule.id}`);
    requireValue(adminBypass(detail, permission), `push login ${login} is not verified as a bypass actor for ${rule.name}`);
  }
  return `${login}: verified repository administrator bypass`;
});
check('open issues (report)', () => JSON.stringify(json('gh', ['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,labels']).filter((issue) => issue.labels.some((label) => /^(p0|p1|bug)$/i.test(label.name)))));
report(results, args.includes('--json'));
