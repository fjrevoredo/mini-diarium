import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import TitleEditor from './TitleEditor';

describe('TitleEditor component', () => {
  it('should render with initial value', () => {
    render(() => <TitleEditor value="Test Title" />);

    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input.value).toBe('Test Title');
  });

  it('should call onInput when user types', async () => {
    const user = userEvent.setup();
    const onInputMock = vi.fn();

    render(() => <TitleEditor value="" onInput={onInputMock} />);

    const input = screen.getByPlaceholderText(/title/i);
    await user.type(input, 'New Title');

    // onInput should be called for each character
    expect(onInputMock).toHaveBeenCalled();
    expect(onInputMock).toHaveBeenCalledWith('New Title');
  });

  it('should call onEnter when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const onEnterMock = vi.fn();

    render(() => <TitleEditor value="Test" onEnter={onEnterMock} />);

    const input = screen.getByPlaceholderText(/title/i);
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(onEnterMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onEnter for other keys', async () => {
    const user = userEvent.setup();
    const onEnterMock = vi.fn();

    render(() => <TitleEditor value="Test" onEnter={onEnterMock} />);

    const input = screen.getByPlaceholderText(/title/i);
    await user.click(input);
    await user.keyboard('abc');
    await user.keyboard('{Space}');
    await user.keyboard('{Backspace}');

    expect(onEnterMock).not.toHaveBeenCalled();
  });

  it('should show placeholder when empty', () => {
    render(() => <TitleEditor value="" placeholder="Custom placeholder" />);

    const input = screen.getByPlaceholderText('Custom placeholder');
    expect(input).toBeInTheDocument();
  });

  it('should respect spellCheck prop', () => {
    const { unmount } = render(() => <TitleEditor value="Test" spellCheck={false} />);

    const input = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input.getAttribute('spellcheck')).toBe('false');

    unmount();

    render(() => <TitleEditor value="Test" spellCheck={true} />);
    const input2 = screen.getByPlaceholderText(/title/i) as HTMLInputElement;
    expect(input2.getAttribute('spellcheck')).toBe('true');
  });
});
