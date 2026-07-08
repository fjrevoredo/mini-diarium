import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import type { Editor } from '@tiptap/core';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { preferences, resetPreferences } from '../../state/preferences';
import TimestampOverlay from './TimestampOverlay';

/**
 * Minimal TipTap editor mock exposing the fluent chain used by handleConfirm:
 * `editor.chain().focus().insertContent(html).run()`.
 */
function makeEditorMock() {
  const chain = {
    focus: vi.fn(() => chain),
    insertContent: vi.fn(() => chain),
    run: vi.fn(() => chain),
  };
  const editor = { chain: vi.fn(() => chain) } as unknown as Editor;
  return { editor, chain };
}

describe('TimestampOverlay', () => {
  beforeEach(() => {
    resetPreferences();
    // Freeze the clock so the inserted timestamp is deterministic (13:45:30).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T13:45:30'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inserts a 24h H:M:S timestamp wrapped in a span, then closes', async () => {
    const onClose = vi.fn();
    const { editor, chain } = makeEditorMock();
    renderWithI18n(() => <TimestampOverlay editor={editor} isOpen={true} onClose={onClose} />);

    fireEvent.change(await screen.findByTestId('timestamp-format-select'), {
      target: { value: '24h' },
    });
    fireEvent.change(screen.getByTestId('timestamp-precision-select'), {
      target: { value: 'hms' },
    });

    fireEvent.click(screen.getByTestId('timestamp-insert-button'));

    expect(chain.insertContent).toHaveBeenCalledWith('<span class="timestamp">13:45:30</span>');
    expect(chain.run).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('inserts a 12h H:M timestamp (default format/precision)', async () => {
    const onClose = vi.fn();
    const { editor, chain } = makeEditorMock();
    renderWithI18n(() => <TimestampOverlay editor={editor} isOpen={true} onClose={onClose} />);

    fireEvent.click(await screen.findByTestId('timestamp-insert-button'));

    expect(chain.insertContent).toHaveBeenCalledWith('<span class="timestamp">01:45 PM</span>');
  });

  it('persists the format and precision selects to preferences', async () => {
    const { editor } = makeEditorMock();
    renderWithI18n(() => <TimestampOverlay editor={editor} isOpen={true} onClose={() => {}} />);

    fireEvent.change(await screen.findByTestId('timestamp-format-select'), {
      target: { value: '24h' },
    });
    expect(preferences().timestampFormat).toBe('24h');

    fireEvent.change(screen.getByTestId('timestamp-precision-select'), {
      target: { value: 'hms' },
    });
    expect(preferences().timestampPrecision).toBe('hms');
  });

  it('disables the insert button when no editor is available', async () => {
    renderWithI18n(() => <TimestampOverlay editor={null} isOpen={true} onClose={() => {}} />);

    expect(await screen.findByTestId('timestamp-insert-button')).toBeDisabled();
  });

  it('does not insert when the editor is null even if insert is invoked', async () => {
    const onClose = vi.fn();
    renderWithI18n(() => <TimestampOverlay editor={null} isOpen={true} onClose={onClose} />);

    // The button is disabled, so a click is a no-op — nothing is inserted or closed.
    fireEvent.click(await screen.findByTestId('timestamp-insert-button'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the Cancel button is clicked', async () => {
    const onClose = vi.fn();
    const { editor } = makeEditorMock();
    renderWithI18n(() => <TimestampOverlay editor={editor} isOpen={true} onClose={onClose} />);

    fireEvent.click(await screen.findByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const { editor } = makeEditorMock();
    renderWithI18n(() => <TimestampOverlay editor={editor} isOpen={true} onClose={onClose} />);

    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
