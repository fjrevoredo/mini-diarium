import { createSignal, Show } from 'solid-js';
import { Menu, Lock, Info } from 'lucide-solid';
import { selectedDate, setIsAboutOpen, isSidebarCollapsed } from '../../state/ui';
import { lockJournal } from '../../state/auth';
import { useI18n } from '../../i18n';

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
    return date.toLocaleDateString(undefined, {
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
      {/* Left: hamburger + date */}
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
        <h1 class="text-lg font-semibold text-primary">{formattedDate()}</h1>
      </div>

      {/* Right: About + Lock */}
      <div class="flex items-center gap-1">
        <button
          onClick={() => setIsAboutOpen(true)}
          class="rounded p-2 hover:bg-hover text-tertiary transition-colors"
          aria-label={t('layout.header.about')}
        >
          <Info size={20} />
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
      </div>
    </header>
  );
}
