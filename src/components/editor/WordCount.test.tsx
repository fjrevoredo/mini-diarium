import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import WordCount from './WordCount';

describe('WordCount component', () => {
  it('should render word count with plural', () => {
    const { container } = render(() => <WordCount count={42} />);
    const text = container.textContent;

    expect(text).toContain('42');
    expect(text).toContain('words');
  });

  it('should show singular "word" for count of 1', () => {
    const { container } = render(() => <WordCount count={1} />);
    const text = container.textContent;

    expect(text).toContain('1');
    expect(text).toMatch(/\bword\b/);
    expect(text).not.toContain('words');
  });

  it('should show plural "words" for count of 0', () => {
    const { container } = render(() => <WordCount count={0} />);
    const text = container.textContent;

    expect(text).toContain('0');
    expect(text).toContain('words');
  });
});
