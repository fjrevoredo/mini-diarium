import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { resetUiState } from '../../state/ui';
import HeaderMoreMenu from './HeaderMoreMenu';

// The feature-flag gate that hides the whole ⋮ menu lives at the Header call site
// (see Header.test.tsx). This component is flag-agnostic: whenever it renders, it
// shows all four items. This test verifies that full set.

describe('HeaderMoreMenu', () => {
  beforeEach(() => {
    resetUiState();
  });

  it('shows Preferences, Statistics, Import, and Export when opened', async () => {
    const user = userEvent.setup();
    renderWithI18n(() => <HeaderMoreMenu />);

    await user.click(screen.getByTestId('header-more-menu-trigger'));

    await waitFor(() => screen.getByTestId('header-more-menu-preferences-item'));
    expect(screen.getByTestId('header-more-menu-preferences-item')).toBeInTheDocument();
    expect(screen.getByTestId('header-more-menu-statistics-item')).toBeInTheDocument();
    expect(screen.getByTestId('header-more-menu-import-item')).toBeInTheDocument();
    expect(screen.getByTestId('header-more-menu-export-item')).toBeInTheDocument();
  });
});
