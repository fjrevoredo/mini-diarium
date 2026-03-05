import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { EntryNavBar } from './EntryNavBar';

const noop = () => {};

describe('EntryNavBar — + button always visible', () => {
  it('shows + button when total is 0 (empty day)', () => {
    const { container } = render(() => (
      <EntryNavBar total={0} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Add entry"]')).not.toBeNull();
  });

  it('shows + button when total is 1 (single entry)', () => {
    const { container } = render(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Add entry"]')).not.toBeNull();
  });

  it('shows + button when total is 2', () => {
    const { container } = render(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Add entry"]')).not.toBeNull();
  });
});

describe('EntryNavBar — navigation hidden below 2 entries', () => {
  it('hides prev/next arrows when total is 0', () => {
    const { container } = render(() => (
      <EntryNavBar total={0} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).toBeNull();
  });

  it('hides prev/next arrows when total is 1', () => {
    const { container } = render(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).toBeNull();
  });

  it('shows prev/next arrows when total is 2', () => {
    const { container } = render(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).not.toBeNull();
  });

  it('shows prev/next arrows when total is 3', () => {
    const { container } = render(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).not.toBeNull();
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

describe('EntryNavBar — delete button', () => {
  it('does NOT render delete button when total is 1', () => {
    const mockDelete = vi.fn();
    const { container } = render(() => (
      <EntryNavBar
        total={1}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onDelete={mockDelete}
      />
    ));
    expect(container.querySelector('[aria-label="Delete entry"]')).toBeNull();
  });

  it('does NOT render delete button when onDelete not provided', () => {
    const { container } = render(() => (
      <EntryNavBar total={3} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Delete entry"]')).toBeNull();
  });

  it('renders delete button when total > 1 and onDelete provided', () => {
    const mockDelete = vi.fn();
    const { container } = render(() => (
      <EntryNavBar
        total={3}
        index={1}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onDelete={mockDelete}
      />
    ));
    expect(container.querySelector('[aria-label="Delete entry"]')).not.toBeNull();
  });

  it('calls onDelete callback when delete button clicked', () => {
    const mockDelete = vi.fn();
    const { container } = render(() => (
      <EntryNavBar
        total={2}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onDelete={mockDelete}
      />
    ));
    const deleteBtn = container.querySelector('[aria-label="Delete entry"]') as HTMLButtonElement;
    deleteBtn.click();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('disables delete button when deleteDisabled is true', () => {
    const mockDelete = vi.fn();
    const { container } = render(() => (
      <EntryNavBar
        total={2}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onDelete={mockDelete}
        deleteDisabled={true}
      />
    ));
    const deleteBtn = container.querySelector('[aria-label="Delete entry"]') as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it('uses default aria-label when deleteTitle not provided', () => {
    const mockDelete = vi.fn();
    const { container } = render(() => (
      <EntryNavBar
        total={2}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onDelete={mockDelete}
      />
    ));
    expect(container.querySelector('[aria-label="Delete entry"]')).not.toBeNull();
  });

  it('uses custom aria-label from deleteTitle prop', () => {
    const mockDelete = vi.fn();
    const { container } = render(() => (
      <EntryNavBar
        total={2}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onDelete={mockDelete}
        deleteTitle="Remove this entry"
      />
    ));
    expect(container.querySelector('[aria-label="Remove this entry"]')).not.toBeNull();
  });
});
