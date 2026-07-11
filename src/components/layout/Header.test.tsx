import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { mainView, resetUiState, isPreferencesOpen } from '../../state/ui';
import { setFeatureFlag } from '../../state/feature-flags';

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

describe('Header more menu', () => {
  beforeEach(() => {
    resetUiState();
    localStorage.clear();
    setFeatureFlag('inAppMenu', false);
  });

  afterEach(() => {
    setFeatureFlag('inAppMenu', false);
    localStorage.clear();
  });

  it('hides the ⋮ overflow menu entirely when the inAppMenu flag is off', () => {
    renderWithI18n(() => <Header />);

    expect(screen.queryByTestId('header-more-menu-trigger')).not.toBeInTheDocument();
  });

  it('opens Preferences via the overflow menu when the inAppMenu flag is on', async () => {
    setFeatureFlag('inAppMenu', true);
    const user = userEvent.setup();
    renderWithI18n(() => <Header />);

    expect(isPreferencesOpen()).toBe(false);

    await user.click(screen.getByTestId('header-more-menu-trigger'));

    const preferencesItem = await waitFor(() =>
      screen.getByTestId('header-more-menu-preferences-item'),
    );
    await user.click(preferencesItem);

    await waitFor(() => expect(isPreferencesOpen()).toBe(true));
  });
});
