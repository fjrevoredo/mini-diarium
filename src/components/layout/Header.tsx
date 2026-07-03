import { createSignal, Show } from 'solid-js';
import { Menu, Lock, Info, Bell, List, PenLine, Search } from 'lucide-solid';
import {
  selectedDate,
  setIsAboutOpen,
  isSidebarCollapsed,
  setIsNotificationsOpen,
  mainView,
  setMainView,
  setIsSearchOpen,
} from '../../state/ui';
import { lockJournal } from '../../state/auth';
import { preferences } from '../../state/preferences';
import { useI18n } from '../../i18n';
import { hasUnread, unreadCount } from '../../state/notifications';
import HeaderMoreMenu from './HeaderMoreMenu';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export default function Header(props: HeaderProps) {
  const t = useI18n();
  const [isLocking, setIsLocking] = createSignal(false);

  // Format date: "Tuesday, January 1, 2019"
  const formattedDate = () => {
    const date = new Date(selectedDate() + 'T00:00:00');
    return date.toLocaleDateString(preferences().language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleLock = async () => {
    if (isLocking()) return;
    setIsLocking(true);
    try {
      await lockJournal();
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <header class="flex h-16 items-center justify-between border-b border-primary bg-primary px-4">
      {/* Left: hamburger + search + date */}
      <div class="flex items-center gap-3">
        <Show when={props.showMenu}>
          <button
            onClick={() => props.onMenuClick?.()}
            data-testid="toggle-sidebar-button"
            class="rounded p-2 hover:bg-hover text-primary lg:hidden"
            aria-label={t('layout.header.toggleMenu')}
            aria-expanded={!isSidebarCollapsed()}
            aria-controls="sidebar"
          >
            <Menu size={24} />
          </button>
        </Show>
        <button
          onClick={() => setIsSearchOpen(true)}
          data-testid="search-button"
          class="rounded p-2 hover:bg-hover text-tertiary transition-colors"
          aria-label={t('layout.header.search')}
        >
          <Search size={20} />
        </button>
        <h1 class="text-lg font-semibold text-primary">{formattedDate()}</h1>
      </div>

      {/* Right: Timeline toggle + About + Notifications + Lock */}
      <div class="flex items-center gap-1">
        <button
          onClick={() => setMainView(mainView() === 'timeline' ? 'editor' : 'timeline')}
          class="rounded p-2 hover:bg-hover text-tertiary transition-colors"
          aria-label={
            mainView() === 'timeline'
              ? t('layout.header.showEditor')
              : t('layout.header.showTimeline')
          }
          aria-pressed={mainView() === 'timeline'}
          data-testid="timeline-toggle-button"
        >
          <Show when={mainView() === 'timeline'} fallback={<List size={20} />}>
            <PenLine size={20} />
          </Show>
        </button>
        <button
          data-tour-target="about"
          onClick={() => setIsAboutOpen(true)}
          class="rounded p-2 hover:bg-hover text-tertiary transition-colors"
          aria-label={t('layout.header.about')}
        >
          <Info size={20} />
        </button>
        <button
          onClick={() => setIsNotificationsOpen(true)}
          class="relative rounded p-2 hover:bg-hover text-tertiary transition-colors"
          aria-label={
            hasUnread()
              ? t('layout.header.notificationsUnread', { count: unreadCount() })
              : t('layout.header.notificationsNone')
          }
          data-testid="notifications-button"
        >
          <Bell size={20} />
          <Show when={hasUnread()}>
            <span
              class="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-interactive text-xs font-bold leading-none"
              style={{ color: 'var(--btn-primary-text)' }}
              aria-hidden="true"
            >
              {unreadCount() > 9 ? '9+' : unreadCount()}
            </span>
          </Show>
        </button>
        <button
          onClick={() => handleLock()}
          disabled={isLocking()}
          data-testid="lock-journal-button"
          class="rounded p-2 hover:bg-hover text-tertiary transition-colors disabled:opacity-50"
          aria-label={t('layout.header.lockJournal')}
        >
          <Lock size={20} />
        </button>
        <HeaderMoreMenu />
      </div>
    </header>
  );
}
