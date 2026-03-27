import { describe, it, expect } from 'vitest';
import { renderWithI18n } from '../../test/i18n-test-utils';
import WordCount from './WordCount';

describe('WordCount component', () => {
  it('should render word count with plural', () => {
    const { container } = renderWithI18n(() => <WordCount count={42} />);
    const text = container.textContent;

    expect(text).toContain('42');
    expect(text).toContain('words');
  });

  it('should show singular "word" for count of 1', () => {
    const { container } = renderWithI18n(() => <WordCount count={1} />);
    const text = container.textContent;

    expect(text).toContain('1');
    expect(text).toMatch(/\bword\b/);
    expect(text).not.toContain('words');
  });

  it('should show plural "words" for count of 0', () => {
    const { container } = renderWithI18n(() => <WordCount count={0} />);
    const text = container.textContent;

    expect(text).toContain('0');
    expect(text).toContain('words');
  });
});
