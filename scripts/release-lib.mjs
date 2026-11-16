import { execFileSync } from 'node:child_process';

export function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();
}

export function json(command, args) {
  return JSON.parse(run(command, args));
}

export function unreleased(changelog) {
  const versions = changelog.split(/^# Versions\s*$/m)[1];
  const first = versions?.match(/^## \[[^\]]+\].*$/m);
  if (!first) return null;
  const match = versions.slice(first.index).match(/^## \[([^\]]+)\] - Unreleased[^\S\r\n]*\r?\n([\s\S]*?)(?=^## \[|(?![\s\S]))/m);
  return match ? { version: match[1], body: match[2].trim() } : null;
}

export function report(results, asJson) {
  if (asJson) console.log(JSON.stringify(results, null, 2));
  else for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`);
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}

export function workflowState(runs, sha, optional = false) {
  const found = runs.find((run) => run.headSha === sha);
  if (!found) return optional ? 'absent' : 'missing';
  return found.status === 'completed' && found.conclusion === 'success' ? 'green' : 'not green';
}

export function missingSecrets(output, required) {
  const names = output.split('\n').map((line) => line.split(/\s+/)[0]);
  return required.filter((name) => !names.includes(name));
}

export function adminBypass(rule, permission) {
  const refs = rule.conditions?.ref_name;
  return rule.enforcement === 'active' && rule.target === 'branch' &&
    refs?.include?.includes('refs/heads/master') && !refs.exclude?.includes('refs/heads/master') &&
    permission === 'admin' && rule.bypass_actors?.some((actor) => actor.actor_type === 'RepositoryRole' && actor.actor_id === 5 && actor.bypass_mode !== 'pull_request');
}
