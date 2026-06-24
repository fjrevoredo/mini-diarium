import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { mainView, resetUiState } from '../../state/ui';

import Header from './Header';

describe('Header timeline toggle', () => {
  beforeEach(() => {
    resetUiState();
  });

  it('reflects and switches the main view via aria-pressed', () => {
    renderWithI18n(() => <Header />);

    const toggle = screen.getByTestId('timeline-toggle-button');

    // Default view is the editor: not pressed, labelled "Show timeline".
    expect(mainView()).toBe('editor');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Show timeline');

    fireEvent.click(toggle);

    // Now showing the timeline: pressed, labelled "Show editor".
    expect(mainView()).toBe('timeline');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Show editor');

    fireEvent.click(toggle);

    expect(mainView()).toBe('editor');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
