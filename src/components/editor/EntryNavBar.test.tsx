import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { EntryNavBar } from './EntryNavBar';

const noop = () => {};

describe('EntryNavBar visibility', () => {
  it('is hidden when total is 0', () => {
    const { container } = render(() => (
      <EntryNavBar total={0} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).toBeNull();
  });

  it('is hidden when total is 1 (single entry — no navigation needed)', () => {
    const { container } = render(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).toBeNull();
  });

  it('is visible when total is 2', () => {
    const { container } = render(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).not.toBeNull();
  });

  it('is visible when total is 3', () => {
    const { container } = render(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).not.toBeNull();
  });
});

describe('EntryNavBar counter', () => {
  it('shows "1 / 2" when on first of two entries', () => {
    const { getByText } = render(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(getByText('1 / 2')).toBeInTheDocument();
  });

  it('shows "2 / 2" when on second of two entries', () => {
    const { getByText } = render(() => (
      <EntryNavBar total={2} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(getByText('2 / 2')).toBeInTheDocument();
  });

  it('shows "2 / 3" when on middle entry', () => {
    const { getByText } = render(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(getByText('2 / 3')).toBeInTheDocument();
  });
});

describe('EntryNavBar arrow disabled states', () => {
  it('disables prev arrow at index 0', () => {
    const { container } = render(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const prev = container.querySelector('[aria-label="Previous entry"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('enables prev arrow when not at first entry', () => {
    const { container } = render(() => (
      <EntryNavBar total={2} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const prev = container.querySelector('[aria-label="Previous entry"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
  });

  it('disables next arrow at last index', () => {
    const { container } = render(() => (
      <EntryNavBar total={2} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const next = container.querySelector('[aria-label="Next entry"]') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('enables next arrow when not at last entry', () => {
    const { container } = render(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const next = container.querySelector('[aria-label="Next entry"]') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
  });
});
