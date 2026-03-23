import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    args.set(key, value);
    index += 1;
  }

  return {
    manifestDir: args.get('manifest-dir'),
    releaseNotesFile: args.get('release-notes-file'),
    releaseNotesUrl: args.get('release-notes-url'),
    releaseDate: args.get('release-date'),
  };
}

function stripMarkdownLinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

function stripMarkdownFormatting(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
}

function removeHtmlComments(text) {
  let previous;
  let current = text;
  do {
    previous = current;
    current = current.replace(/<!--[\s\S]*?-->/g, '');
  } while (current !== previous);
  return current;
}

function wrapLine(line, width = 100) {
  if (!line || line.length <= width) {
    return [line];
  }

  const bulletMatch = line.match(/^(-\s+)(.*)$/);
  const firstPrefix = bulletMatch ? bulletMatch[1] : '';
  const continuationPrefix = bulletMatch ? ' '.repeat(firstPrefix.length) : '';
  const content = bulletMatch ? bulletMatch[2] : line;
  const words = content.split(' ');
  const wrapped = [];

  let current = firstPrefix;
  let currentWidth = current.length;

  for (const word of words) {
    const prefix = wrapped.length === 0 ? firstPrefix : continuationPrefix;
    if (
      (wrapped.length === 0 && current === firstPrefix) ||
      (wrapped.length > 0 && current === continuationPrefix)
    ) {
      current += word;
      currentWidth = current.length;
      continue;
    }

    if (currentWidth + 1 + word.length <= width) {
      current += ` ${word}`;
      currentWidth = current.length;
      continue;
    }

    wrapped.push(current);
    current = `${continuationPrefix}${word}`;
    currentWidth = current.length;
  }

  wrapped.push(current);
  return wrapped;
}

export function normalizeReleaseNotes(markdown) {
  const normalizedLines = removeHtmlComments(
    markdown.replace(/\r\n/g, '\n')
  )
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => !(line === '' && lines[index - 1] === ''))
    .map((line) => {
      if (line.startsWith('#')) {
        return line.replace(/^#+\s*/, '');
      }

      if (line.startsWith('> ')) {
        return line.slice(2);
      }

      return line;
    })
    .map(stripMarkdownLinks)
    .map(stripMarkdownFormatting)
    .map((line) => line.replace(/^- \[ \]\s+/g, '- '))
    .map((line) => line.replace(/^- \[x\]\s+/gi, '- '))
    .map((line) => line.replace(/^\d+\.\s+/g, '- '))
    .map((line) => line.replace(/\s+/g, ' ').trimEnd())
    .flatMap((line) => wrapLine(line));

  const normalized = normalizedLines.join('\n').trim();
  if (!normalized) {
    throw new Error('Release body did not contain any usable release notes');
  }

  return normalized;
}

function findDefaultLocaleManifest(manifestDir) {
  const entries = readdirSync(manifestDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(manifestDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findDefaultLocaleManifest(entryPath);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (!entry.name.endsWith('.yaml')) {
      continue;
    }

    const contents = readFileSync(entryPath, 'utf8');
    if (/^ManifestType:\s*defaultLocale\s*$/m.test(contents)) {
      return entryPath;
    }
  }

  return null;
}

function removeManifestField(lines, key) {
  const prefix = `${key}:`;
  const fieldIndex = lines.findIndex((line) => line.startsWith(prefix));
  if (fieldIndex === -1) {
    return lines;
  }

  const nextIndex = fieldIndex + 1;
  let removeUntil = nextIndex;

  if (lines[fieldIndex].startsWith(`${prefix} |`)) {
    while (removeUntil < lines.length) {
      const line = lines[removeUntil];
      if (line.startsWith('  ')) {
        removeUntil += 1;
        continue;
      }
      break;
    }
  }

  const updatedLines = [...lines];
  updatedLines.splice(fieldIndex, removeUntil - fieldIndex);
  return updatedLines;
}

function insertBeforeManifestType(lines, fieldLines) {
  const manifestTypeIndex = lines.findIndex((line) => line.startsWith('ManifestType:'));
  if (manifestTypeIndex === -1) {
    throw new Error('Could not find ManifestType in defaultLocale manifest');
  }

  const updatedLines = [...lines];
  updatedLines.splice(manifestTypeIndex, 0, ...fieldLines);
  return updatedLines;
}

function buildReleaseNotesField(releaseNotes) {
  return ['ReleaseNotes: |-', ...releaseNotes.split('\n').map((line) => `  ${line}`)];
}

export function enrichDefaultLocaleManifest(manifestText, { releaseNotes, releaseNotesUrl, releaseDate }) {
  let lines = manifestText.replace(/\r\n/g, '\n').trimEnd().split('\n');
  lines = removeManifestField(lines, 'ReleaseDate');
  lines = removeManifestField(lines, 'ReleaseNotes');
  lines = removeManifestField(lines, 'ReleaseNotesUrl');
  lines = insertBeforeManifestType(lines, [
    ...(releaseDate ? [`ReleaseDate: ${releaseDate}`] : []),
    ...buildReleaseNotesField(releaseNotes),
    `ReleaseNotesUrl: ${releaseNotesUrl}`,
  ]);
  return `${lines.join('\n')}\n`;
}

function ensureDirectoryExists(directoryPath) {
  const stats = statSync(directoryPath, { throwIfNoEntry: false });
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Manifest directory does not exist: ${directoryPath}`);
  }
}

function main() {
  const { manifestDir, releaseNotesFile, releaseNotesUrl, releaseDate } = parseArgs(process.argv.slice(2));

  if (!manifestDir || !releaseNotesFile || !releaseNotesUrl) {
    throw new Error(
      'Usage: node scripts/enrich-winget-manifest.mjs --manifest-dir <dir> --release-notes-file <file> --release-notes-url <url> [--release-date <yyyy-MM-dd>]',
    );
  }

  ensureDirectoryExists(manifestDir);

  const releaseBody = readFileSync(releaseNotesFile, 'utf8');
  const releaseNotes = normalizeReleaseNotes(releaseBody);
  const manifestPath = findDefaultLocaleManifest(manifestDir);

  if (!manifestPath) {
    throw new Error(`Could not find defaultLocale manifest under ${manifestDir}`);
  }

  const manifestText = readFileSync(manifestPath, 'utf8');
  const enrichedManifest = enrichDefaultLocaleManifest(manifestText, {
    releaseNotes,
    releaseNotesUrl,
    releaseDate,
  });

  writeFileSync(manifestPath, enrichedManifest, 'utf8');
  process.stdout.write(`${manifestPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
