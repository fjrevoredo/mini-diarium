import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { openUrl } from '@tauri-apps/plugin-opener';

import type { NotificationEntry } from '../../state/notifications';
import NotificationDetailDialog from './NotificationDetailDialog';

const baseEntry: NotificationEntry = {
  id: 'test-notif',
  type: 'release',
  version: '1.0',
  title: 'Test notification',
  summary: 'Short summary.',
  body: '## Heading\n\nSome **bold** detail text.',
  date: '2026-04-19',
};

describe('NotificationDetailDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the entry body as markdown content', () => {
    renderWithI18n(() => <NotificationDetailDialog isOpen entry={baseEntry} onClose={() => {}} />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('shows the external link button when linkUrl and linkLabel are present', () => {
    const entry: NotificationEntry = {
      ...baseEntry,
      linkUrl: 'https://example.com/release',
      linkLabel: 'See release',
    };
    renderWithI18n(() => <NotificationDetailDialog isOpen entry={entry} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('notification-detail-link'));
    expect(openUrl).toHaveBeenCalledWith(entry.linkUrl);
  });

  it('does not show the external link button when linkUrl/linkLabel are absent', () => {
    renderWithI18n(() => <NotificationDetailDialog isOpen entry={baseEntry} onClose={() => {}} />);
    expect(screen.queryByTestId('notification-detail-link')).not.toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    renderWithI18n(() => <NotificationDetailDialog isOpen entry={baseEntry} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('notification-detail-close-button'));
    expect(onClose).toHaveBeenCalled();
  });
});
