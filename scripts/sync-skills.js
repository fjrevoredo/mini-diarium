#!/usr/bin/env node
// Sync skills from .agents/skills into .claude/skills via symlinks/junctions.
// Windows: NTFS junctions (no admin required). macOS/Linux: directory symlinks.
//
// Skills already provided by a Claude Code plugin are excluded to avoid duplicate
// trigger ambiguity. MAINTENANCE: whenever you install a new plugin that ships
// skills, add its skill names to PLUGIN_SKILLS below, then re-run sync-skills.

import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
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
// Second mirror for the pi runtime. Pi has no plugin system, so it receives the
// full canonical set — including the skills excluded from .claude via PLUGIN_SKILLS.
const piTarget = join(root, '.pi', 'skills');

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

function listFilesRecursive(root, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(root, relative));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

export function dirsHaveIdenticalContents(sourceDir, mirrorDir) {
  const sourceFiles = listFilesRecursive(sourceDir);
  const mirrorFiles = listFilesRecursive(mirrorDir);
  if (
    sourceFiles.length !== mirrorFiles.length ||
    sourceFiles.some((file, i) => file !== mirrorFiles[i])
  ) {
    return false;
  }
  return sourceFiles.every((file) =>
    readFileSync(join(sourceDir, file)).equals(readFileSync(join(mirrorDir, file))),
  );
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
    const sourcePath = join(sourceRoot, skill.name);
    const destStat = readPathStat(destination);
    if (destStat) {
      if (destStat.isSymbolicLink()) {
        console.log(`  skip  ${skill.name}`);
        continue;
      }
      // A real directory shadows the canonical source (e.g. materialized by an old
      // git checkout). Silently keeping it means edits to .agents/skills never
      // propagate — repair when contents are identical, refuse when they differ.
      if (!dirsHaveIdenticalContents(sourcePath, destination)) {
        throw new Error(
          `DRIFT: ${destination} is a real directory whose contents differ from ` +
            `${sourcePath}. Reconcile the two manually (the .agents copy is canonical), ` +
            `delete the .claude copy, then re-run sync-skills.`,
        );
      }
      rmSync(destination, { recursive: true, force: true });
      symlinkSync(sourcePath, destination, skillType);
      console.log(`  repair ${skill.name}`);
      linked++;
      continue;
    }

    symlinkSync(sourcePath, destination, skillType);
    console.log(`  link  ${skill.name}`);
    linked++;
  }

  console.log(`\n${linked} skill(s) linked.`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  console.log('.claude/skills:');
  syncSkills();
  console.log('\n.pi/skills:');
  syncSkills({ targetRoot: piTarget, pluginSkills: new Set() });
}

export { LIBRARY_SKILLS, PLUGIN_SKILLS, syncSkills };
