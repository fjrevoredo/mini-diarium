import { createSignal } from 'solid-js';
import { createLogger } from '../lib/logger';

const log = createLogger('Notifications');

export type NotificationType = 'release' | 'announcement' | 'tip';

export interface NotificationEntry {
  id: string;
  type: NotificationType;
  version: string;
  title: string;
  body: string;
  date: string;
  linkUrl?: string;
  linkLabel?: string;
}

const STORAGE_KEY = 'notifications-read';
const STALE_DAYS = 90;

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return new Set(parsed as string[]);
    }
  } catch (err) {
    log.warn('Failed to load read notification IDs:', err);
  }
  return new Set<string>();
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch (err) {
    log.warn('Failed to save read notification IDs:', err);
  }
}

const [allNotifications, setAllNotifications] = createSignal<NotificationEntry[]>([]);
const [readIds, setReadIds] = createSignal<Set<string>>(loadReadIds());
const [isLoading, setIsLoading] = createSignal(false);

export function unreadCount(): number {
  const read = readIds();
  return allNotifications().filter((n) => !read.has(n.id)).length;
}

export function hasUnread(): boolean {
  return unreadCount() > 0;
}

function autoMarkStale(entries: NotificationEntry[]): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const staleIds = entries.filter((n) => new Date(n.date + 'T00:00:00') < cutoff).map((n) => n.id);
  if (staleIds.length === 0) return;
  setReadIds((prev) => {
    const next = new Set(prev);
    staleIds.forEach((id) => next.add(id));
    saveReadIds(next);
    return next;
  });
}

export async function loadNotifications(): Promise<void> {
  setIsLoading(true);
  try {
    const res = await fetch('/notifications.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { entries?: NotificationEntry[] };
    const entries = data.entries ?? [];
    setAllNotifications(entries);
    autoMarkStale(entries);
  } catch (err) {
    log.warn('Failed to load notifications:', err);
    setAllNotifications([]);
  } finally {
    setIsLoading(false);
  }
}

export function markAsRead(id: string): void {
  setReadIds((prev) => {
    const next = new Set(prev);
    next.add(id);
    saveReadIds(next);
    return next;
  });
}

export function markAllRead(): void {
  const all = allNotifications();
  setReadIds((prev) => {
    const next = new Set(prev);
    all.forEach((n) => next.add(n.id));
    saveReadIds(next);
    return next;
  });
}

export function isRead(id: string): boolean {
  return readIds().has(id);
}

export { allNotifications, readIds, isLoading };
