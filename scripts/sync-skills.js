#!/usr/bin/env node
// Sync skills from .agents/skills into .claude/skills via symlinks/junctions.
// Windows: NTFS junctions (no admin required). macOS/Linux: directory symlinks.
//
// Skills already provided by a Claude Code plugin are excluded to avoid duplicate
// trigger ambiguity. MAINTENANCE: whenever you install a new plugin that ships
// skills, add its skill names to PLUGIN_SKILLS below, then re-run sync-skills.

import { lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// These are covered by the rust-skills plugin (rust-skills:<name>).
// Do not link them locally, the plugin version is authoritative.
const PLUGIN_SKILLS = new Set([
  'coding-guidelines',
  'domain-web',
  'm01-ownership',
  'm02-resource',
  'm03-mutability',
  'm04-zero-cost',
  'm05-type-driven',
  'm06-error-handling',
  'm07-concurrency',
  'm09-domain',
  'm10-performance',
  'm11-ecosystem',
  'm12-lifecycle',
  'm13-domain-error',
  'm14-mental-model',
  'm15-anti-pattern',
  'rust-call-graph',
  'rust-code-navigator',
  'rust-daily',
  'rust-deps-visualizer',
  'rust-learner',
  'rust-refactor-helper',
  'rust-skill-creator',
  'rust-symbol-analyzer',
  'rust-trait-explorer',
  'unsafe-checker',
]);

const LIBRARY_SKILLS = new Set([
  'add-locale',
  'apply-dependency-prs',
  'diagram-maintainer',
  'implementation-review',
  'integrate-stale-pr',
  'pre-release',
  'review-external-pr',
  'update-app-icons',
]);

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(scriptPath, '../../');
const source = join(root, '.agents', 'skills');
const target = join(root, '.claude', 'skills');

function getSkillLinkType() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function listSourceSkills(sourceRoot) {
  return readdirSync(sourceRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
}

function readPathStat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function assertMirrorDestination(targetRoot, skillName) {
  const resolvedTargetRoot = resolve(targetRoot);
  const destination = join(resolvedTargetRoot, skillName);
  const resolvedParent = dirname(resolve(destination));
  if (resolvedParent !== resolvedTargetRoot) {
    throw new Error(`Refusing to operate outside mirror root: ${destination}`);
  }
  return destination;
}

export function cleanupLibrarySkillMirrors({ targetRoot, sourceRoot, skillNames }) {
  const removed = [];

  for (const skillName of skillNames) {
    const sourcePath = join(sourceRoot, skillName);
    if (readPathStat(sourcePath)) {
      throw new Error(
        `Refusing to clean mirror for ${skillName} while canonical source still exists at ${sourcePath}`,
      );
    }

    const destination = assertMirrorDestination(targetRoot, skillName);
    const stat = readPathStat(destination);
    if (!stat) {
      continue;
    }

    if (stat.isSymbolicLink()) {
      unlinkSync(destination);
      removed.push({ skillName, destination, type: 'link' });
      continue;
    }

    rmSync(destination, { recursive: true, force: true });
    removed.push({ skillName, destination, type: 'directory' });
  }

  return removed;
}

function ensureTargetRoot(targetRoot) {
  mkdirSync(targetRoot, { recursive: true });
}

function syncSkills({
  sourceRoot = source,
  targetRoot = target,
  pluginSkills = PLUGIN_SKILLS,
  librarySkills = LIBRARY_SKILLS,
} = {}) {
  ensureTargetRoot(targetRoot);
  const skillType = getSkillLinkType();
  const removed = cleanupLibrarySkillMirrors({
    targetRoot,
    sourceRoot,
    skillNames: librarySkills,
  });

  if (removed.length > 0) {
    for (const entry of removed) {
      console.log(`  clean ${entry.skillName}`);
    }
  }

  const skills = listSourceSkills(sourceRoot);
  let linked = 0;

  for (const skill of skills) {
    if (pluginSkills.has(skill.name)) {
      console.log(`  plugin ${skill.name}`);
      continue;
    }

    const destination = join(targetRoot, skill.name);
    if (readPathStat(destination)) {
      console.log(`  skip  ${skill.name}`);
      continue;
    }

    symlinkSync(join(sourceRoot, skill.name), destination, skillType);
    console.log(`  link  ${skill.name}`);
    linked++;
  }

  console.log(`\n${linked} skill(s) linked.`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  syncSkills();
}

export { LIBRARY_SKILLS, PLUGIN_SKILLS, syncSkills };
