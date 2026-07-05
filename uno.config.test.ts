import { describe, it, expect } from 'vitest';
import { createGenerator } from 'unocss';
import config from './uno.config';

describe('uno.config rules', () => {
  it('compiles hover/focus/disabled/data-* variants against hand-authored theme tokens', async () => {
    const generator = await createGenerator({}, config);
    const { css } = await generator.generate(
      new Set([
        'bg-hover',
        'hover:bg-hover',
        'disabled:bg-tertiary',
        'hover:text-primary',
        'data-[highlighted]:bg-hover',
        'hover:bg-active',
        'hover:border-secondary',
        'focus:border-secondary',
      ]),
      { preflights: false }
    );

    expect(css).toContain('.hover\\:bg-hover:hover{background-color:var(--bg-hover);}');
    expect(css).toContain('.disabled\\:bg-tertiary:disabled{background-color:var(--bg-tertiary);}');
    expect(css).toContain('.hover\\:text-primary:hover{color:var(--text-primary);}');
    expect(css).toContain(
      '.data-\\[highlighted\\]\\:bg-hover[data-highlighted]{background-color:var(--bg-hover);}'
    );
    expect(css).toContain('.hover\\:bg-active:hover{background-color:var(--bg-active);}');
    expect(css).toContain('.hover\\:border-secondary:hover{border-color:var(--border-secondary);}');
    expect(css).toContain('.focus\\:border-secondary:focus{border-color:var(--border-secondary);}');
  });
});
