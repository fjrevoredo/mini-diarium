import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { openUrl } from '@tauri-apps/plugin-opener';

import * as notifState from '../../state/notifications';
import * as uiState from '../../state/ui';
import NotificationsOverlay from './NotificationsOverlay';

const sampleEntry = {
  id: 'test-notif',
  type: 'release' as const,
  version: '1.0',
  title: 'Test notification',
  summary: 'This is the body text.',
  date: '2026-04-19',
  linkUrl: 'https://example.com/release',
  linkLabel: 'See release',
};

const sampleEntryWithBody = {
  ...sampleEntry,
  id: 'test-notif-with-body',
  body: '## Full detail\n\n- one\n- two',
};

function openOverlay() {
  uiState.setIsNotificationsOpen(true);
}

describe('NotificationsOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
    uiState.setIsNotificationsOpen(false);
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([]);
    vi.spyOn(notifState, 'isRead').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the title when open', () => {
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.getByText("What's New")).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.getByText('No announcements yet.')).toBeInTheDocument();
  });

  it('renders an entry when notifications exist', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.getByText('Test notification')).toBeInTheDocument();
    expect(screen.getByText('This is the body text.')).toBeInTheDocument();
  });

  it('shows unread dot for unread entry', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    vi.spyOn(notifState, 'isRead').mockReturnValue(false);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.getByTestId(`unread-dot-${sampleEntry.id}`)).toBeInTheDocument();
  });

  it('does not show unread dot for read entry', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    vi.spyOn(notifState, 'isRead').mockReturnValue(true);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.queryByTestId(`unread-dot-${sampleEntry.id}`)).not.toBeInTheDocument();
  });

  it('"Mark read" button calls markAsRead with correct id', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    vi.spyOn(notifState, 'isRead').mockReturnValue(false);
    const markAsReadSpy = vi.spyOn(notifState, 'markAsRead').mockImplementation(() => {});
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    fireEvent.click(screen.getByTestId(`mark-read-${sampleEntry.id}`));
    expect(markAsReadSpy).toHaveBeenCalledWith(sampleEntry.id);
  });

  it('"Mark all read" button calls markAllRead and closes overlay', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    const markAllReadSpy = vi.spyOn(notifState, 'markAllRead').mockImplementation(() => {});
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    fireEvent.click(screen.getByTestId('mark-all-read-button'));
    expect(markAllReadSpy).toHaveBeenCalled();
    expect(uiState.isNotificationsOpen()).toBe(false);
  });

  it('link button calls openUrl with the correct URL', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    fireEvent.click(screen.getByTestId(`link-${sampleEntry.id}`));
    expect(openUrl).toHaveBeenCalledWith(sampleEntry.linkUrl);
  });

  it('close button sets isNotificationsOpen to false', () => {
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    fireEvent.click(screen.getByTestId('notifications-close-button'));
    expect(uiState.isNotificationsOpen()).toBe(false);
  });

  it('does not show a Read more button when entry.body is absent', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntry]);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.queryByTestId(`read-more-${sampleEntry.id}`)).not.toBeInTheDocument();
  });

  it('shows a Read more button when entry.body is present and opens the detail dialog', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntryWithBody]);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    expect(screen.queryByTestId('notification-detail-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`read-more-${sampleEntryWithBody.id}`));
    expect(screen.getByTestId('notification-detail-dialog')).toBeInTheDocument();
  });

  it('closing the detail dialog removes it while the list dialog stays open', () => {
    vi.spyOn(notifState, 'allNotifications').mockReturnValue([sampleEntryWithBody]);
    openOverlay();
    renderWithI18n(() => <NotificationsOverlay />);
    fireEvent.click(screen.getByTestId(`read-more-${sampleEntryWithBody.id}`));
    expect(screen.getByTestId('notification-detail-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('notification-detail-close-button'));
    expect(screen.queryByTestId('notification-detail-dialog')).not.toBeInTheDocument();
    expect(uiState.isNotificationsOpen()).toBe(true);
    expect(screen.getByText('Test notification')).toBeInTheDocument();
  });
});
