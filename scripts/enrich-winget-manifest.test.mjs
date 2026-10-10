import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichDefaultLocaleManifest,
  MAX_RELEASE_NOTES_LENGTH,
  normalizeReleaseNotes,
} from './enrich-winget-manifest.mjs';

describe('enrich-winget-manifest', () => {
  it('normalizeReleaseNotes strips markdown while keeping structure', () => {
    const normalized = normalizeReleaseNotes(`
## What's Changed

- **Feature:** Added [WinGet support](https://example.com)
1. Fixed \`race condition\`
> Note from maintainer
`);

    assert.equal(
      normalized,
      [
        "What's Changed",
        '',
        '- Feature: Added WinGet support (https://example.com)',
        '- Fixed race condition',
        'Note from maintainer',
      ].join('\n'),
    );
  });

  it('normalizeReleaseNotes wraps long bullet lines to keep them readable', () => {
    const normalized = normalizeReleaseNotes(`
- This is a deliberately long bullet line that should wrap before it becomes too wide for WinGet locale manifest guidance.
`);

    const lines = normalized.split('\n');
    assert.ok(lines.length > 1);
    assert.ok(lines.every((line) => line.length <= 100));
    assert.match(lines[0], /^- /);
    assert.match(lines[1], /^  /);
  });

  it('normalizeReleaseNotes truncates output over the WinGet 10000-character manifest limit', () => {
    const lines = Array.from(
      { length: 400 },
      (_, index) => `- Change entry number ${index} with enough padding text to add up.`,
    );
    const body = lines.join('\n');
    assert.ok(body.length > MAX_RELEASE_NOTES_LENGTH);

    const normalized = normalizeReleaseNotes(body);

    assert.ok(normalized.length <= MAX_RELEASE_NOTES_LENGTH);
    assert.match(normalized, /… \(truncated — see ReleaseNotesUrl for full notes\)$/);
  });

  it('normalizeReleaseNotes truncation cuts on a line boundary, never mid-word', () => {
    const lines = Array.from(
      { length: 400 },
      (_, index) => `- Change entry number ${index} with enough padding text to add up.`,
    );
    const body = lines.join('\n');

    const normalized = normalizeReleaseNotes(body);
    const withoutSuffix = normalized.replace(
      /\n… \(truncated — see ReleaseNotesUrl for full notes\)$/,
      '',
    );
    const keptLines = withoutSuffix.split('\n');

    for (const line of keptLines) {
      assert.ok(lines.includes(line), `unexpected line: ${line}`);
    }
  });

  it('enrichDefaultLocaleManifest replaces release fields before ManifestType', () => {
    const manifest = [
      'PackageIdentifier: fjrevoredo.MiniDiarium',
      'PackageVersion: 0.4.8',
      'PackageLocale: en-US',
      'Publisher: Francisco Revoredo',
      'ReleaseNotesUrl: https://old.example.com',
      'ManifestType: defaultLocale',
      'ManifestVersion: 1.12.0',
      '',
    ].join('\n');

    const enriched = enrichDefaultLocaleManifest(manifest, {
      releaseNotes: 'Line one\nLine two',
      releaseNotesUrl: 'https://github.com/fjrevoredo/mini-diarium/releases/tag/v0.4.8',
    });

    assert.match(
      enriched,
      /ReleaseNotes: \|-\n  Line one\n  Line two\nReleaseNotesUrl: https:\/\/github.com\/fjrevoredo\/mini-diarium\/releases\/tag\/v0\.4\.8\nManifestType: defaultLocale/,
    );
    assert.doesNotMatch(enriched, /https:\/\/old\.example\.com/);
  });
});
