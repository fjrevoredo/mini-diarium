import { describe, it, expect, vi } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import PreferencesBackupsTab from './PreferencesBackupsTab';

vi.mock('../../backups/BackupsPanel', () => ({
  default: (props: { isVisible: () => boolean }) => (
    <div data-testid="backups-panel-stub">{String(props.isVisible())}</div>
  ),
}));

describe('PreferencesBackupsTab', () => {
  it('renders as a tabpanel wired to its tab button', () => {
    renderWithI18n(() => <PreferencesBackupsTab isOpen={() => true} onClose={() => {}} />);

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'pref-panel-backups');
    expect(panel).toHaveAttribute('aria-labelledby', 'pref-tab-backups');
  });

  it('passes its visibility through to the shared panel, so a hidden tab does not load', () => {
    renderWithI18n(() => <PreferencesBackupsTab isOpen={() => false} onClose={() => {}} />);
    expect(screen.getByTestId('backups-panel-stub')).toHaveTextContent('false');
  });
});
