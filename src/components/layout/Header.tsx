import { createSignal, Show } from 'solid-js';
import { Menu, Lock, Info } from 'lucide-solid';
import { selectedDate, setIsAboutOpen } from '../../state/ui';
import { lockDiary } from '../../state/auth';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export default function Header(props: HeaderProps) {
  const [isLocking, setIsLocking] = createSignal(false);

  // Format date: "Tuesday, January 1, 2019"
  const formattedDate = () => {
    const date = new Date(selectedDate() + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
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
      await lockDiary();
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <header class="border-b border-primary bg-primary px-4 py-3">
      <div class="flex items-center justify-between">
        {/* Left: hamburger + date */}
        <div class="flex items-center gap-3">
          <Show when={props.showMenu}>
            <button
              onClick={props.onMenuClick}
              data-testid="toggle-sidebar-button"
              class="rounded p-2 hover:bg-hover text-primary lg:hidden"
              aria-label="Toggle menu"
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
            aria-label="About"
          >
            <Info size={20} />
          </button>
          <button
            onClick={() => handleLock()}
            disabled={isLocking()}
            data-testid="lock-diary-button"
            class="rounded p-2 hover:bg-hover text-tertiary transition-colors disabled:opacity-50"
            aria-label="Lock diary"
          >
            <Lock size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
