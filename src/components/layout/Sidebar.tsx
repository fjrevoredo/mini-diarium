import { Show, createEffect, onCleanup } from 'solid-js';
import { X, Calendar as CalendarIcon } from 'lucide-solid';
import Calendar from '../calendar/Calendar';
import { selectedDate, setSelectedDate } from '../../state/ui';
import { getTodayString } from '../../lib/dates';

interface SidebarProps {
  isCollapsed: boolean;
  onClose?: () => void;
}

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sidebar(props: SidebarProps) {
  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={sidebarRef}; ESLint can't see the JSX assignment
  let sidebarRef!: HTMLElement;
  let previousFocus: Element | null = null;

  createEffect(() => {
    if (!props.isCollapsed) {
      // Store element that had focus before sidebar opened
      previousFocus = document.activeElement;
      // Move focus into the sidebar after it renders
      requestAnimationFrame(() => {
        const firstFocusable = sidebarRef?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
        firstFocusable?.focus();
      });
    } else {
      // Restore focus to the element that opened the sidebar
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
        previousFocus = null;
      }
    }
  });

  const handleSidebarKeyDown = (e: KeyboardEvent) => {
    if (props.isCollapsed) return;
    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      sidebarRef.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
    ).filter((el) => el.offsetParent !== null); // visible only

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  onCleanup(() => {
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
      previousFocus = null;
    }
  });

  return (
    <>
      {/* Mobile overlay */}
      <Show when={!props.isCollapsed}>
        <div
          class="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          aria-hidden="true"
          onClick={() => props.onClose?.()}
        />
      </Show>

      {/* Sidebar */}
      <aside
        id="sidebar"
        ref={sidebarRef}
        onKeyDown={handleSidebarKeyDown}
        class={`fixed inset-y-0 left-0 z-30 w-80 transform bg-primary border-r border-primary transition-transform duration-300 lg:relative lg:translate-x-0 ${
          props.isCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
        aria-label="Navigation"
      >
        <div class="flex h-full flex-col">
          {/* Sidebar Header */}
          <div class="flex h-16 items-center justify-between border-b border-primary px-4">
            <h2 class="text-xl font-bold text-primary">Mini Diarium</h2>
            <Show when={!props.isCollapsed}>
              <button
                onClick={() => props.onClose?.()}
                class="rounded p-2 hover:bg-hover text-primary lg:hidden"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </Show>
          </div>

          {/* Sidebar Content */}
          <div class="flex-1 overflow-y-auto p-4">
            <div class="space-y-4">
              {/* Go to Today button */}
              <div class="flex justify-start">
                <button
                  onClick={() => setSelectedDate(getTodayString())}
                  disabled={selectedDate() === getTodayString()}
                  class="flex items-center gap-1 rounded-md bg-tertiary px-3 py-2 text-sm font-medium text-secondary hover:bg-active disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Go to Today"
                  title="Go to Today"
                >
                  <CalendarIcon size={16} />
                </button>
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
