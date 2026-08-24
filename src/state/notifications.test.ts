import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Module is re-imported per test group that needs fresh module state.
// For tests that rely on module-level signals we use vi.resetModules().

// Several tests below seed notifications with fixed dates (e.g. '2026-04-01')
// and rely on the 90-day staleness cutoff in `autoMarkStale` *not* tripping.
// That cutoff compares against the real wall-clock `new Date()`, so without
// pinning "now" these tests silently break once enough real time passes.
// Anchor "now" for the whole file so the cutoff math stays deterministic.
const FIXED_NOW = new Date('2026-04-20T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadReadIds / saveReadIds (via module init)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('returns empty Set when localStorage key is absent', async () => {
    const { readIds } = await import('./notifications');
    expect(readIds().size).toBe(0);
  });

  it('parses a valid JSON array from localStorage', async () => {
    localStorage.setItem('notifications-read', JSON.stringify(['a', 'b']));
    const { readIds } = await import('./notifications');
    expect(readIds().has('a')).toBe(true);
    expect(readIds().has('b')).toBe(true);
  });

  it('returns empty Set for malformed JSON', async () => {
    localStorage.setItem('notifications-read', '{bad json}');
    const { readIds } = await import('./notifications');
    expect(readIds().size).toBe(0);
  });
});

describe('markAsRead', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('adds the id, persists to localStorage, and is idempotent', async () => {
    const { markAsRead, isRead } = await import('./notifications');
    expect(isRead('x')).toBe(false);
    markAsRead('x');
    expect(isRead('x')).toBe(true);
    markAsRead('x'); // idempotent
    expect(isRead('x')).toBe(true);
    const stored = JSON.parse(localStorage.getItem('notifications-read') ?? '[]') as string[];
    expect(stored).toContain('x');
    expect(stored.filter((v) => v === 'x').length).toBe(1);
  });
});

describe('markAllRead', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('marks all loaded notifications read and persists', async () => {
    const mod = await import('./notifications');
    // Inject entries via the exported setter-equivalent loadNotifications mock
    // We can't call the setter directly, so we load via fetch mock
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            entries: [
              {
                id: 'a',
                type: 'release',
                version: '1',
                title: 'A',
                summary: '',
                date: '2026-04-01',
              },
              { id: 'b', type: 'tip', version: '1', title: 'B', summary: '', date: '2026-04-02' },
            ],
          }),
      } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    await mod.loadNotifications();

    expect(mod.unreadCount()).toBe(2);
    mod.markAllRead();
    expect(mod.unreadCount()).toBe(0);
    const stored = JSON.parse(localStorage.getItem('notifications-read') ?? '[]') as string[];
    expect(stored).toContain('a');
    expect(stored).toContain('b');
  });

  it('is a no-op when there are no notifications', async () => {
    const mod = await import('./notifications');
    mod.markAllRead();
    expect(mod.unreadCount()).toBe(0);
  });
});

describe('isRead / unreadCount / hasUnread', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('tracks counts correctly with mixed read/unread state', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [
                {
                  id: 'n1',
                  type: 'release',
                  version: '1',
                  title: 'N1',
                  summary: '',
                  date: '2026-04-01',
                },
                {
                  id: 'n2',
                  type: 'tip',
                  version: '1',
                  title: 'N2',
                  summary: '',
                  date: '2026-04-02',
                },
              ],
            }),
        } as Response),
      ),
    );
    await mod.loadNotifications();

    expect(mod.unreadCount()).toBe(2);
    expect(mod.hasUnread()).toBe(true);

    mod.markAsRead('n1');
    expect(mod.unreadCount()).toBe(1);
    expect(mod.isRead('n1')).toBe(true);
    expect(mod.isRead('n2')).toBe(false);

    mod.markAllRead();
    expect(mod.unreadCount()).toBe(0);
    expect(mod.hasUnread()).toBe(false);
  });
});

describe('loadNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates allNotifications on success', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [
                {
                  id: 'v1',
                  type: 'release',
                  version: '1.0',
                  title: 'V1',
                  summary: 'body',
                  date: '2026-04-01',
                },
              ],
            }),
        } as Response),
      ),
    );
    await mod.loadNotifications();
    expect(mod.allNotifications().length).toBe(1);
    expect(mod.allNotifications()[0].id).toBe('v1');
    expect(mod.isLoading()).toBe(false);
  });

  it('passes an entry with a body field through unchanged, and leaves body undefined when absent', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [
                {
                  id: 'with-body',
                  type: 'release',
                  version: '1.0',
                  title: 'With body',
                  summary: 'short summary',
                  body: '## Full detail\n\n- one\n- two',
                  date: '2026-04-01',
                },
                {
                  id: 'without-body',
                  type: 'tip',
                  version: '1.0',
                  title: 'Without body',
                  summary: 'short summary',
                  date: '2026-04-02',
                },
              ],
            }),
        } as Response),
      ),
    );
    await mod.loadNotifications();
    const [withBody, withoutBody] = mod.allNotifications();
    expect(withBody.body).toBe('## Full detail\n\n- one\n- two');
    expect(withoutBody.body).toBeUndefined();
  });

  it('sets allNotifications to [] on non-ok status', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response)),
    );
    await mod.loadNotifications();
    expect(mod.allNotifications()).toEqual([]);
    expect(mod.isLoading()).toBe(false);
  });

  it('sets allNotifications to [] on malformed JSON', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('bad json')),
        } as unknown as Response),
      ),
    );
    await mod.loadNotifications();
    expect(mod.allNotifications()).toEqual([]);
    expect(mod.isLoading()).toBe(false);
  });

  it('returns [] when entries field is missing', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response),
      ),
    );
    await mod.loadNotifications();
    expect(mod.allNotifications()).toEqual([]);
  });

  it('auto-marks entries older than 90 days as read', async () => {
    const mod = await import('./notifications');
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 91);
    const oldDateStr = oldDate.toISOString().split('T')[0];
    const recentDateStr = '2026-04-19';

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [
                {
                  id: 'old',
                  type: 'tip',
                  version: '1',
                  title: 'Old',
                  summary: '',
                  date: oldDateStr,
                },
                {
                  id: 'recent',
                  type: 'release',
                  version: '1',
                  title: 'Recent',
                  summary: '',
                  date: recentDateStr,
                },
              ],
            }),
        } as Response),
      ),
    );
    await mod.loadNotifications();

    expect(mod.isRead('old')).toBe(true);
    expect(mod.isRead('recent')).toBe(false);
    const stored = JSON.parse(localStorage.getItem('notifications-read') ?? '[]') as string[];
    expect(stored).toContain('old');
    expect(stored).not.toContain('recent');
  });

  it('does not auto-mark entries within 90 days', async () => {
    const mod = await import('./notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [
                {
                  id: 'fresh',
                  type: 'release',
                  version: '1',
                  title: 'Fresh',
                  summary: '',
                  date: '2026-04-19',
                },
              ],
            }),
        } as Response),
      ),
    );
    await mod.loadNotifications();
    expect(mod.isRead('fresh')).toBe(false);
  });

  it('already-read stale entries remain read (idempotent)', async () => {
    localStorage.setItem('notifications-read', JSON.stringify(['stale-id']));
    const mod = await import('./notifications');
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100);
    const oldDateStr = oldDate.toISOString().split('T')[0];

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [
                {
                  id: 'stale-id',
                  type: 'tip',
                  version: '1',
                  title: 'Stale',
                  summary: '',
                  date: oldDateStr,
                },
              ],
            }),
        } as Response),
      ),
    );
    await mod.loadNotifications();
    expect(mod.isRead('stale-id')).toBe(true);
    const stored = JSON.parse(localStorage.getItem('notifications-read') ?? '[]') as string[];
    expect(stored.filter((v) => v === 'stale-id').length).toBe(1);
  });
});
