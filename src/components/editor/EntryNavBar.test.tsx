import { describe, it, expect, vi } from 'vitest';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { EntryNavBar } from './EntryNavBar';

const noop = () => {};

describe('EntryNavBar — + button always visible', () => {
  it('shows + button when total is 0 (empty day)', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={0} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Add entry"]')).not.toBeNull();
  });

  it('shows + button when total is 1 (single entry)', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Add entry"]')).not.toBeNull();
  });

  it('shows + button when total is 2', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Add entry"]')).not.toBeNull();
  });
});

describe('EntryNavBar — navigation hidden below 2 entries', () => {
  it('hides prev/next arrows when total is 0', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={0} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).toBeNull();
  });

  it('hides prev/next arrows when total is 1', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).toBeNull();
  });

  it('shows prev/next arrows when total is 2', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).not.toBeNull();
  });

  it('shows prev/next arrows when total is 3', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Previous entry"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next entry"]')).not.toBeNull();
  });
});

describe('EntryNavBar number buttons', () => {
  it('renders number buttons 1 and 2 when total is 2', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[data-testid="entry-number-button-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="entry-number-button-2"]')).not.toBeNull();
  });

  it('renders number buttons 1, 2, 3 when total is 3', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[data-testid="entry-number-button-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="entry-number-button-2"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="entry-number-button-3"]')).not.toBeNull();
  });

  it('does not render number buttons when total is 0', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={0} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[data-testid="entry-number-button-1"]')).toBeNull();
  });

  it('does not render number buttons when total is 1', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[data-testid="entry-number-button-1"]')).toBeNull();
  });
});

describe('EntryNavBar number button highlight', () => {
  it('highlights the current entry with aria-current and font-bold', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const activeBtn = container.querySelector('[data-testid="entry-number-button-2"]')!;
    expect(activeBtn.getAttribute('aria-current')).toBe('true');
    expect(activeBtn.classList.contains('font-bold')).toBe(true);
    expect(activeBtn.classList.contains('text-primary')).toBe(true);
  });

  it('does not highlight non-active entries', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const btn1 = container.querySelector('[data-testid="entry-number-button-1"]')!;
    const btn3 = container.querySelector('[data-testid="entry-number-button-3"]')!;
    expect(btn1.getAttribute('aria-current')).toBeNull();
    expect(btn1.classList.contains('font-bold')).toBe(false);
    expect(btn3.getAttribute('aria-current')).toBeNull();
    expect(btn3.classList.contains('font-bold')).toBe(false);
  });

  it('highlights first entry when index is 0', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const btn1 = container.querySelector('[data-testid="entry-number-button-1"]')!;
    expect(btn1.getAttribute('aria-current')).toBe('true');
    expect(btn1.classList.contains('font-bold')).toBe(true);
  });
});

describe('EntryNavBar direct jump', () => {
  it('calls onGoTo with correct 0-based index when clicking number button', () => {
    const onGoTo = vi.fn();
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={0} onPrev={noop} onNext={noop} onGoTo={onGoTo} onAdd={noop} />
    ));
    const btn3 = container.querySelector(
      '[data-testid="entry-number-button-3"]',
    ) as HTMLButtonElement;
    btn3.click();
    expect(onGoTo).toHaveBeenCalledTimes(1);
    expect(onGoTo).toHaveBeenCalledWith(2);
  });

  it('calls onGoTo with 0 when clicking button 1', () => {
    const onGoTo = vi.fn();
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={2} onPrev={noop} onNext={noop} onGoTo={onGoTo} onAdd={noop} />
    ));
    const btn1 = container.querySelector(
      '[data-testid="entry-number-button-1"]',
    ) as HTMLButtonElement;
    btn1.click();
    expect(onGoTo).toHaveBeenCalledWith(0);
  });

  it('clicking an entry number button is a genuine no-op when onGoTo is not provided', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onAdd = vi.fn();
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={0} onPrev={onPrev} onNext={onNext} onAdd={onAdd} />
    ));
    const btn = container.querySelector(
      '[data-testid="entry-number-button-2"]',
    ) as HTMLButtonElement;
    btn.click();
    // No other handler is accidentally fired, and the controlled selection is unchanged.
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(btn).not.toHaveAttribute('aria-current');
    expect(container.querySelector('[data-testid="entry-number-button-1"]')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('EntryNavBar arrow disabled states', () => {
  it('disables prev arrow at index 0', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const prev = container.querySelector('[aria-label="Previous entry"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('enables prev arrow when not at first entry', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const prev = container.querySelector('[aria-label="Previous entry"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
  });

  it('disables next arrow at last index', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={2} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const next = container.querySelector('[aria-label="Next entry"]') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('enables next arrow when not at last entry', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={1} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    const next = container.querySelector('[aria-label="Next entry"]') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
  });
});

describe('EntryNavBar — delete button', () => {
  it('does NOT render delete button when total is 1', () => {
    const mockDelete = vi.fn();
    const { container } = renderWithI18n(() => (
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
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={3} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[aria-label="Delete entry"]')).toBeNull();
  });

  it('renders delete button when total > 1 and onDelete provided', () => {
    const mockDelete = vi.fn();
    const { container } = renderWithI18n(() => (
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
    const { container } = renderWithI18n(() => (
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
    const { container } = renderWithI18n(() => (
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
    const { container } = renderWithI18n(() => (
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
    const { container } = renderWithI18n(() => (
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

describe('EntryNavBar — lock button', () => {
  it('does NOT render lock button when onToggleLock not provided', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar total={1} index={0} onPrev={noop} onNext={noop} onAdd={noop} />
    ));
    expect(container.querySelector('[data-testid="entry-lock-button"]')).toBeNull();
  });

  it('renders lock button for a single entry (unlike delete)', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar
        total={1}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onToggleLock={noop}
      />
    ));
    expect(container.querySelector('[data-testid="entry-lock-button"]')).not.toBeNull();
  });

  it('calls onToggleLock when the lock button is clicked', () => {
    const onToggleLock = vi.fn();
    const { container } = renderWithI18n(() => (
      <EntryNavBar
        total={1}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onToggleLock={onToggleLock}
      />
    ));
    const btn = container.querySelector('[data-testid="entry-lock-button"]') as HTMLButtonElement;
    btn.click();
    expect(onToggleLock).toHaveBeenCalledTimes(1);
  });

  it('disables the lock button when lockDisabled is true (no persisted id)', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar
        total={1}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onToggleLock={noop}
        lockDisabled={true}
      />
    ));
    const btn = container.querySelector('[data-testid="entry-lock-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('reflects the locked state via aria-pressed and default aria-label', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar
        total={1}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onToggleLock={noop}
        locked={true}
      />
    ));
    const btn = container.querySelector('[data-testid="entry-lock-button"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Unlock entry');
  });

  it('uses the Lock/Unlock aria-label based on locked state', () => {
    const { container } = renderWithI18n(() => (
      <EntryNavBar
        total={1}
        index={0}
        onPrev={noop}
        onNext={noop}
        onAdd={noop}
        onToggleLock={noop}
        locked={false}
      />
    ));
    const btn = container.querySelector('[data-testid="entry-lock-button"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Lock entry');
  });
});
