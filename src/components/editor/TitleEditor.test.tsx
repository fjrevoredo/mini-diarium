import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import userEvent from '@testing-library/user-event';
import TitleEditor from './TitleEditor';

describe('TitleEditor component', () => {
  it('should render with initial value', () => {
    renderWithI18n(() => <TitleEditor value="Test Title" />);

    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input.value).toBe('Test Title');
  });

  it('should call onInput when user types', async () => {
    const user = userEvent.setup();
    const onInputMock = vi.fn();

    renderWithI18n(() => <TitleEditor value="" onInput={onInputMock} />);

    const input = screen.getByPlaceholderText(/title/i);
    await user.type(input, 'New Title');

    // onInput should be called for each character
    expect(onInputMock).toHaveBeenCalled();
    expect(onInputMock).toHaveBeenCalledWith('New Title');
  });

  it('should call onEnter when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const onEnterMock = vi.fn();

    renderWithI18n(() => <TitleEditor value="Test" onEnter={onEnterMock} />);

    const input = screen.getByPlaceholderText(/title/i);
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(onEnterMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onEnter for other keys', async () => {
    const user = userEvent.setup();
    const onEnterMock = vi.fn();

    renderWithI18n(() => <TitleEditor value="Test" onEnter={onEnterMock} />);

    const input = screen.getByPlaceholderText(/title/i);
    await user.click(input);
    await user.keyboard('abc');
    await user.keyboard('{Space}');
    await user.keyboard('{Backspace}');

    expect(onEnterMock).not.toHaveBeenCalled();
  });

  it('should show placeholder when empty', () => {
    renderWithI18n(() => <TitleEditor value="" placeholder="Custom placeholder" />);

    const input = screen.getByPlaceholderText('Custom placeholder');
    expect(input).toBeInTheDocument();
  });

  it('should respect spellCheck prop', () => {
    const { unmount } = renderWithI18n(() => <TitleEditor value="Test" spellCheck={false} />);

    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input.getAttribute('spellcheck')).toBe('false');

    unmount();

    renderWithI18n(() => <TitleEditor value="Test" spellCheck={true} />);
    const input2 = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input2.getAttribute('spellcheck')).toBe('true');
  });

  it('is read-only and does not auto-focus when readOnly is set', () => {
    renderWithI18n(() => <TitleEditor value="Locked" readOnly={true} />);
    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(document.activeElement).not.toBe(input);
  });

  it('auto-focuses and is editable when readOnly is not set', () => {
    renderWithI18n(() => <TitleEditor value="Open" />);
    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('does not re-steal focus when a dependency of readOnly changes after mount', async () => {
    // Mirrors EditorPanel: readOnly is `currentLocked()`, derived from dayEntries. A new
    // array notifies even though the derived value is unchanged. Auto-focus must fire once,
    // at mount — as a tracking effect it re-focused the title on every entry-list change,
    // stealing the caret from the editor mid-typing so the rest of the sentence was typed
    // into the title. See TODO-0089.
    const [entries, setEntries] = createSignal([{ locked: false }]);
    renderWithI18n(() => <TitleEditor value="Open" readOnly={entries()[0]?.locked ?? false} />);
    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    // The user clicks into the body editor.
    const elsewhere = document.createElement('input');
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);

    // startEntryCreation's setDayEntries lands while they are still typing.
    setEntries([{ locked: false }]);
    await Promise.resolve();

    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });
});
