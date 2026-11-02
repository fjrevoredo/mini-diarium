import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';

import * as uiState from '../../state/ui';
import AboutOverlay from './AboutOverlay';

describe('AboutOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    uiState.setIsProjectSupportOpen(false);
    uiState.setProjectSupportEntry('about');
  });

  it('shows the Fenmark name with the temporary "formerly Mini Diarium" note', () => {
    renderWithI18n(() => <AboutOverlay isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'Fenmark' })).toBeInTheDocument();
    expect(screen.getByText('(formerly Mini Diarium)')).toBeInTheDocument();
  });

  it('clicking "Support Fenmark" sets projectSupportEntry to about, opens the overlay, and closes About', () => {
    const onClose = vi.fn();
    renderWithI18n(() => <AboutOverlay isOpen={true} onClose={onClose} />);

    const supportButton = screen.getByRole('button', { name: 'Support Fenmark' });
    expect(supportButton.querySelector('svg')).toHaveClass('text-pink-500');
    fireEvent.click(supportButton);

    expect(uiState.projectSupportEntry()).toBe('about');
    expect(uiState.isProjectSupportOpen()).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
