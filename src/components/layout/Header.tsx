import { Show } from 'solid-js';
import { Menu } from 'lucide-solid';
import { selectedDate } from '../../state/ui';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export default function Header(props: HeaderProps) {
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

  return (
    <header class="border-b border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Show when={props.showMenu}>
            <button
              onClick={props.onMenuClick}
              class="rounded p-2 hover:bg-gray-100 lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
          </Show>
          <h1 class="text-lg font-semibold text-gray-900">{formattedDate()}</h1>
        </div>
      </div>
    </header>
  );
}
