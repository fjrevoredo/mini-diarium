import { Show } from 'solid-js';
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
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </Show>
          <h1 class="text-lg font-semibold text-gray-900">{formattedDate()}</h1>
        </div>
      </div>
    </header>
  );
}
