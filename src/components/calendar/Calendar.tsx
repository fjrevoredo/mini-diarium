import { createSignal, createEffect, untrack, For, createMemo, Show } from 'solid-js';
import { ChevronLeft, ChevronRight } from 'lucide-solid';
import { selectedDate, setSelectedDate, setIsSidebarCollapsed } from '../../state/ui';
import { entryDates } from '../../state/entries';
import { preferences } from '../../state/preferences';
import { getTodayString } from '../../lib/dates';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEntry: boolean;
  isFuture: boolean;
  isDisabled: boolean;
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = createSignal(new Date());
  const [showPicker, setShowPicker] = createSignal(false);
  const [pickerYear, setPickerYear] = createSignal(new Date().getFullYear());

  // Generate calendar days for the current month
  const calendarDays = createMemo((): CalendarDay[] => {
    const month = currentMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    // First day of the month
    const firstDay = new Date(year, monthIndex, 1);
    // Last day of the month
    const lastDay = new Date(year, monthIndex + 1, 0);

    // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfMonth = firstDay.getDay();

    // Get entry dates for checking
    const dates = entryDates();
    const today = getTodayString();
    const allowFuture = preferences().allowFutureEntries;

    // Get preferred first day of week (0 = Sunday, 1 = Monday, etc.)
    // null means use system default (Sunday in US locale)
    const preferredFirstDay = preferences().firstDayOfWeek ?? 0;

    // Calculate how many days from previous month to show
    // We need to show days until we reach the preferred first day of week
    const daysFromPrevMonth = (firstDayOfMonth - preferredFirstDay + 7) % 7;

    // Days from previous month to show
    const prevMonthDays: CalendarDay[] = [];
    const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const prevMonth = monthIndex - 1;
      const prevYear = prevMonth < 0 ? year - 1 : year;
      const actualMonth = prevMonth < 0 ? 11 : prevMonth;
      const dateStr = `${prevYear}-${String(actualMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isFuture = dateStr > today;
      prevMonthDays.push({
        date: dateStr,
        day,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasEntry: dates.includes(dateStr),
        isFuture,
        isDisabled: !allowFuture && isFuture,
      });
    }

    // Days of current month
    const currentMonthDays: CalendarDay[] = [];
    const selected = selectedDate();

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isFuture = dateStr > today;
      currentMonthDays.push({
        date: dateStr,
        day,
        isCurrentMonth: true,
        isToday: dateStr === today,
        isSelected: dateStr === selected,
        hasEntry: dates.includes(dateStr),
        isFuture,
        isDisabled: !allowFuture && isFuture,
      });
    }

    // Days from next month to fill the grid
    const totalDays = prevMonthDays.length + currentMonthDays.length;
    const remainingDays = 42 - totalDays; // 6 weeks * 7 days
    const nextMonthDays: CalendarDay[] = [];
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonth = monthIndex + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const actualMonth = nextMonth > 11 ? 0 : nextMonth;
      const dateStr = `${nextYear}-${String(actualMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isFuture = dateStr > today;
      nextMonthDays.push({
        date: dateStr,
        day,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasEntry: dates.includes(dateStr),
        isFuture,
        isDisabled: !allowFuture && isFuture,
      });
    }

    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  });

  const monthName = () => {
    return currentMonth().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth().getFullYear(), currentMonth().getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth().getFullYear(), currentMonth().getMonth() + 1));
  };

  // Sync calendar month when selectedDate changes to a different month.
  // currentMonth is read via untrack so changes to it (prev/next month buttons)
  // do NOT re-trigger this effect — only selectedDate changes do.
  createEffect(() => {
    const d = new Date(selectedDate() + 'T00:00:00');
    const cm = untrack(currentMonth);
    if (d.getFullYear() !== cm.getFullYear() || d.getMonth() !== cm.getMonth()) {
      setCurrentMonth(d);
    }
  });

  const handleDayClick = (day: CalendarDay) => {
    if (day.isDisabled) return;
    setSelectedDate(day.date);
    setIsSidebarCollapsed(true);
  };

  // Week day headers, rotated based on preference
  const weekDays = createMemo(() => {
    const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const preferredFirstDay = preferences().firstDayOfWeek ?? 0;

    // Rotate array to start on preferred day
    return [...allDays.slice(preferredFirstDay), ...allDays.slice(0, preferredFirstDay)];
  });

  return (
    <div class="rounded-lg bg-primary p-4 shadow-sm">
      {/* Calendar header */}
      <div class="mb-4 flex items-center justify-between">
        {/* Left button: prev-month OR prev-year */}
        <Show
          when={showPicker()}
          fallback={
            <button
              onClick={previousMonth}
              class="rounded p-2 hover:bg-hover text-primary"
              aria-label="Previous month"
            >
              <ChevronLeft size={20} />
            </button>
          }
        >
          <button
            onClick={() => setPickerYear((y) => y - 1)}
            class="rounded p-2 hover:bg-hover text-primary"
            aria-label="Previous year"
          >
            <ChevronLeft size={20} />
          </button>
        </Show>

        {/* Centre: toggle button (shows month+year or just year) */}
        <button
          onClick={() => {
            setPickerYear(currentMonth().getFullYear());
            setShowPicker((v) => !v);
          }}
          class="text-sm font-semibold text-primary hover:bg-hover rounded px-2 py-1"
          aria-label={showPicker() ? 'Close month picker' : 'Open month picker'}
        >
          <Show when={showPicker()} fallback={monthName()}>
            {pickerYear()}
          </Show>
        </button>

        {/* Right button: next-month OR next-year */}
        <Show
          when={showPicker()}
          fallback={
            <button
              onClick={nextMonth}
              class="rounded p-2 hover:bg-hover text-primary"
              aria-label="Next month"
            >
              <ChevronRight size={20} />
            </button>
          }
        >
          <button
            onClick={() => setPickerYear((y) => y + 1)}
            class="rounded p-2 hover:bg-hover text-primary"
            aria-label="Next year"
          >
            <ChevronRight size={20} />
          </button>
        </Show>
      </div>

      <Show
        when={showPicker()}
        fallback={
          <>
            {/* Week day headers */}
            <div class="mb-2 grid grid-cols-7 gap-1">
              <For each={weekDays()}>
                {(day) => <div class="text-center text-xs font-medium text-tertiary">{day}</div>}
              </For>
            </div>

            {/* Calendar grid */}
            <div class="grid grid-cols-7 gap-1">
              <For each={calendarDays()}>
                {(day) => (
                  <button
                    data-testid={`calendar-day-${day.date}`}
                    onClick={() => handleDayClick(day)}
                    class={`
                    relative h-8 w-8 rounded text-sm flex flex-col items-center justify-center
                    ${day.isCurrentMonth ? 'text-primary' : 'text-muted'}
                    ${day.isToday ? 'font-bold' : ''}
                    ${day.isSelected ? 'interactive-primary' : !day.isDisabled ? 'hover:bg-hover' : ''}
                    ${day.isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                  `}
                    disabled={day.isDisabled}
                  >
                    <span>{day.day}</span>
                    {day.hasEntry && (
                      <span
                        class={`
                        h-1 w-1 rounded-full mt-0.5
                        ${day.isSelected ? 'bg-white' : 'bg-interactive'}
                      `}
                      />
                    )}
                  </button>
                )}
              </For>
            </div>
          </>
        }
      >
        {/* Month picker grid — 3×4 */}
        <div class="grid grid-cols-3 gap-1 py-1">
          <For each={MONTH_NAMES}>
            {(name, i) => (
              <button
                onClick={() => {
                  setCurrentMonth(new Date(pickerYear(), i()));
                  setShowPicker(false);
                }}
                class={`text-sm rounded py-2 text-center
                  ${
                    pickerYear() === currentMonth().getFullYear() &&
                    i() === currentMonth().getMonth()
                      ? 'interactive-primary'
                      : 'text-primary hover:bg-hover'
                  }
                `}
                aria-label={`${name} ${pickerYear()}`}
              >
                {name}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
