#!/usr/bin/env node
// Sync skills from .agents/skills into .claude/skills via symlinks/junctions.
// Windows: NTFS junctions (no admin required). macOS/Linux: directory symlinks.
// Safe to re-run: skips entries that already exist in .claude/skills.
//
// Skills already provided by a Claude Code plugin are excluded to avoid duplicate
// trigger ambiguity. MAINTENANCE: whenever you install a new plugin that ships
// skills, add its skill names to PLUGIN_SKILLS below, then re-run sync-skills.

import { readdirSync, existsSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// These are covered by the rust-skills plugin (rust-skills:<name>).
// Do not link them locally — the plugin version is authoritative.
const PLUGIN_SKILLS = new Set([
  'coding-guidelines',
  'domain-web',
  'm01-ownership', 'm02-resource', 'm03-mutability', 'm04-zero-cost',
  'm05-type-driven', 'm06-error-handling', 'm07-concurrency', 'm09-domain',
  'm10-performance', 'm11-ecosystem', 'm12-lifecycle', 'm13-domain-error',
  'm14-mental-model', 'm15-anti-pattern',
  'rust-call-graph', 'rust-code-navigator', 'rust-daily', 'rust-deps-visualizer',
  'rust-learner', 'rust-refactor-helper', 'rust-skill-creator', 'rust-symbol-analyzer',
  'rust-trait-explorer', 'unsafe-checker',
]);

const root = resolve(fileURLToPath(import.meta.url), '../../');
const source = join(root, '.agents', 'skills');
const target = join(root, '.claude', 'skills');

const skills = readdirSync(source, { withFileTypes: true }).filter(d => d.isDirectory());
const type = process.platform === 'win32' ? 'junction' : 'dir';

let linked = 0;
for (const skill of skills) {
  if (PLUGIN_SKILLS.has(skill.name)) {
    console.log(`  plugin ${skill.name}`);
    continue;
  }
  const dest = join(target, skill.name);
  if (existsSync(dest)) {
    console.log(`  skip  ${skill.name}`);
  } else {
    symlinkSync(join(source, skill.name), dest, type);
    console.log(`  link  ${skill.name}`);
    linked++;
  }
}

console.log(`\n${linked} skill(s) linked.`);
