import { Show } from 'solid-js';
import { X, Calendar as CalendarIcon } from 'lucide-solid';
import Calendar from '../calendar/Calendar';
import SearchBar from '../search/SearchBar';
import SearchResults from '../search/SearchResults';
import { selectedDate, setSelectedDate } from '../../state/ui';
import { getTodayString } from '../../lib/dates';

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
                  <X size={24} />
                </button>
              </Show>
            </div>
          </div>

          {/* Sidebar Content */}
          <div class="flex-1 overflow-y-auto p-4">
            <div class="space-y-4">
              {/* Search with Go to Today button */}
              <div class="space-y-2">
                <div class="flex gap-2">
                  <div class="flex-1">
                    <SearchBar />
                  </div>
                  <button
                    onClick={() => setSelectedDate(getTodayString())}
                    disabled={selectedDate() === getTodayString()}
                    class="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
                    aria-label="Go to Today"
                    title="Go to Today"
                  >
                    <CalendarIcon size={16} />
                  </button>
                </div>
                <SearchResults />
              </div>

              {/* Calendar */}
              <Calendar />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
