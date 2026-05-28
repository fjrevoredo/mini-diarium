import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import * as authModule from '../../../state/auth';
import PreferencesOverlay from './PreferencesOverlay';

// Stub child tabs so tests focus on shell behaviour.
vi.mock('./PreferencesGeneralTab', () => ({ default: () => null }));
vi.mock('./PreferencesWritingTab', () => ({ default: () => null }));
vi.mock('./PreferencesSecurityTab', () => ({ default: () => null }));
vi.mock('./PreferencesDataTab', () => ({ default: () => null }));
vi.mock('./PreferencesAdvancedTab', () => ({ default: () => null }));

describe('PreferencesOverlay', () => {
  beforeEach(() => {
    vi.spyOn(authModule, 'authState').mockReturnValue('unlocked');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Preferences dialog title', () => {
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
  });

  it('General tab button has aria-selected="true" by default', () => {
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking the Data tab makes it active', () => {
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Data' }));
    expect(screen.getByRole('tab', { name: 'Data' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'false');
  });

  it('Writing, Security, and Advanced tab buttons are disabled when journal is locked', () => {
    vi.spyOn(authModule, 'authState').mockReturnValue('locked');
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Writing' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Security' })).toBeDisabled();
    // Advanced is not rendered at all when locked
    expect(screen.queryByRole('tab', { name: 'Advanced' })).not.toBeInTheDocument();
  });

  it('Writing, Security, and Advanced tab buttons are enabled when journal is unlocked', () => {
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Writing' })).not.toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Security' })).not.toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Advanced' })).not.toBeDisabled();
  });

  it('renders a close button and no Save/Cancel footer buttons', () => {
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    renderWithI18n(() => <PreferencesOverlay isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
