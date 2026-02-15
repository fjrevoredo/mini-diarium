import { createSignal, For, createMemo } from 'solid-js';
import { selectedDate, setSelectedDate } from '../../state/ui';
import { entryDates } from '../../state/entries';
import { preferences } from '../../state/preferences';
import { getTodayString } from '../../lib/dates';

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
    const firstDayOfWeek = firstDay.getDay();

    // Get entry dates for checking
    const dates = entryDates();
    const today = getTodayString();
    const allowFuture = preferences().allowFutureEntries;

    // Days from previous month to show
    const prevMonthDays: CalendarDay[] = [];
    const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
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

  const handleDayClick = (day: CalendarDay) => {
    // Don't allow clicking disabled days (future dates when preference is off)
    if (day.isDisabled) {
      return;
    }
    if (day.isCurrentMonth) {
      setSelectedDate(day.date);
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div class="rounded-lg bg-white p-4 shadow-sm">
      {/* Calendar header */}
      <div class="mb-4 flex items-center justify-between">
        <button
          onClick={previousMonth}
          class="rounded p-2 hover:bg-gray-100"
          aria-label="Previous month"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h3 class="text-sm font-semibold text-gray-900">{monthName()}</h3>
        <button onClick={nextMonth} class="rounded p-2 hover:bg-gray-100" aria-label="Next month">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Week day headers */}
      <div class="mb-2 grid grid-cols-7 gap-1">
        <For each={weekDays}>
          {(day) => <div class="text-center text-xs font-medium text-gray-500">{day}</div>}
        </For>
      </div>

      {/* Calendar grid */}
      <div class="grid grid-cols-7 gap-1">
        <For each={calendarDays()}>
          {(day) => (
            <button
              onClick={() => handleDayClick(day)}
              class={`
                relative h-8 w-8 rounded text-sm flex flex-col items-center justify-center
                ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                ${day.isToday ? 'font-bold' : ''}
                ${day.isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : !day.isDisabled ? 'hover:bg-gray-100' : ''}
                ${!day.isCurrentMonth || day.isDisabled ? 'cursor-default' : 'cursor-pointer'}
                ${day.isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              disabled={!day.isCurrentMonth || day.isDisabled}
            >
              <span>{day.day}</span>
              {day.hasEntry && (
                <span
                  class={`
                    h-1 w-1 rounded-full mt-0.5
                    ${day.isSelected ? 'bg-white' : 'bg-blue-600'}
                  `}
                />
              )}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
