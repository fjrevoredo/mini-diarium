import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@solidjs/testing-library';

import Wordmark, { WORDMARK_PATHS, WORDMARK_VIEWBOX } from './Wordmark';

describe('Wordmark', () => {
  it('renders an image named Fenmark by default', () => {
    render(() => <Wordmark />);

    expect(screen.getByRole('img', { name: 'Fenmark' })).toBeInTheDocument();
  });

  it('uses the given label as the accessible name', () => {
    render(() => <Wordmark label="Fenmark journal" />);

    expect(screen.getByRole('img', { name: 'Fenmark journal' })).toBeInTheDocument();
  });

  it('draws outlined paths in the text color, with no live text', () => {
    render(() => <Wordmark class="h-5" />);

    const svg = screen.getByRole('img', { name: 'Fenmark' });
    expect(svg).toHaveClass('h-5');
    expect(svg.getAttribute('viewBox')).toBe(WORDMARK_VIEWBOX);
    expect(svg.querySelector('text')).toBeNull();
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(WORDMARK_PATHS.length);
    paths.forEach((path) => expect(path.getAttribute('fill')).toBe('currentColor'));
  });

  it('matches the master wordmark in docs/brand', () => {
    // The master SVG is the source of truth; this fails until the component follows a master change.
    const master = readFileSync(resolve('docs/brand/fenmark-wordmark-dark.svg'), 'utf-8');
    const masterViewBox = /viewBox="([^"]+)"/.exec(master)?.[1];
    const masterPaths = [...master.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

    expect(masterPaths.length).toBeGreaterThan(0);
    expect(WORDMARK_VIEWBOX).toBe(masterViewBox);
    expect([...WORDMARK_PATHS]).toEqual(masterPaths);
  });
});
