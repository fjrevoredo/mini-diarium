import { Show } from 'solid-js';
import Calendar from '../calendar/Calendar';
import SearchBar from '../search/SearchBar';
import SearchResults from '../search/SearchResults';
import { setSelectedDate } from '../../state/ui';

interface SidebarProps {
  isCollapsed: boolean;
  onClose?: () => void;
}

export default function Sidebar(props: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <Show when={!props.isCollapsed}>
        <div class="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden" onClick={props.onClose} />
      </Show>

      {/* Sidebar */}
      <aside
        class={`fixed inset-y-0 left-0 z-30 w-80 transform bg-white border-r border-gray-200 transition-transform duration-300 lg:relative lg:translate-x-0 ${
          props.isCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div class="flex h-full flex-col">
          {/* Sidebar Header */}
          <div class="border-b border-gray-200 px-4 py-3">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900">Mini Diarium</h2>
              <Show when={!props.isCollapsed}>
                <button
                  onClick={props.onClose}
                  class="rounded p-2 hover:bg-gray-100 lg:hidden"
                  aria-label="Close menu"
                >
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </Show>
            </div>
          </div>

          {/* Sidebar Content */}
          <div class="flex-1 overflow-y-auto p-4">
            <div class="space-y-4">
              {/* Search */}
              <div>
                <SearchBar />
                <SearchResults />
              </div>

              {/* Calendar */}
              <Calendar />

              {/* Go to today button */}
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setSelectedDate(today);
                }}
                class="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Go to Today
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
