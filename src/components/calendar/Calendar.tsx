import { createSignal, createEffect, untrack, For, createMemo, Show } from 'solid-js';
import { ChevronLeft, ChevronRight } from 'lucide-solid';
import { selectedDate, setSelectedDate, setIsSidebarCollapsed } from '../../state/ui';
import { entryDates } from '../../state/entries';
import { preferences } from '../../state/preferences';
import { getTodayString } from '../../lib/dates';
import { useI18n } from '../../i18n';

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

/** Format a YYYY-MM-DD string for screen readers, e.g. "Friday, March 20, 2026" */
function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Advance a YYYY-MM-DD date string by `delta` days */
function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Shift a YYYY-MM-DD date string by `delta` months */
function shiftMonth(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Calendar() {
  const t = useI18n();

  // Translated month names for the picker grid (3-letter abbreviations)
  const MONTH_NAMES = createMemo(() => [
    t('calendar.jan'),
    t('calendar.feb'),
    t('calendar.mar'),
    t('calendar.apr'),
    t('calendar.may'),
    t('calendar.jun'),
    t('calendar.jul'),
    t('calendar.aug'),
    t('calendar.sep'),
    t('calendar.oct'),
    t('calendar.nov'),
    t('calendar.dec'),
  ]);

  const [currentMonth, setCurrentMonth] = createSignal(new Date());
  const [showPicker, setShowPicker] = createSignal(false);
  const [pickerYear, setPickerYear] = createSignal(new Date().getFullYear());
  // focusedDate tracks keyboard focus independently from the selected date
  const [focusedDate, setFocusedDate] = createSignal(selectedDate());

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

  // Chunk the flat 42-day array into 6 rows of 7 for the grid structure
  const weeks = createMemo(() => {
    const days = calendarDays();
    return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  });

  const monthName = () => {
    return currentMonth().toLocaleDateString(undefined, {
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
    // Keep focusedDate in sync with selectedDate when user clicks a day
    setFocusedDate(selectedDate());
  });

  const handleDayClick = (day: CalendarDay) => {
    if (day.isDisabled) return;
    setSelectedDate(day.date);
    setFocusedDate(day.date);
    setIsSidebarCollapsed(true);
  };

  // Week day headers, rotated based on preference
  const weekDays = createMemo(() => {
    const allDays = [
      t('calendar.sun'),
      t('calendar.mon'),
      t('calendar.tue'),
      t('calendar.wed'),
      t('calendar.thu'),
      t('calendar.fri'),
      t('calendar.sat'),
    ];
    const fullDays = [
      t('calendar.sunday'),
      t('calendar.monday'),
      t('calendar.tuesday'),
      t('calendar.wednesday'),
      t('calendar.thursday'),
      t('calendar.friday'),
      t('calendar.saturday'),
    ];
    const preferredFirstDay = preferences().firstDayOfWeek ?? 0;

    // Rotate array to start on preferred day
    const rotatedShort = [
      ...allDays.slice(preferredFirstDay),
      ...allDays.slice(0, preferredFirstDay),
    ];
    const rotatedFull = [
      ...fullDays.slice(preferredFirstDay),
      ...fullDays.slice(0, preferredFirstDay),
    ];
    return rotatedShort.map((short, i) => ({ short, full: rotatedFull[i] }));
  });

  // Keyboard navigation on the grid
  const handleGridKeyDown = (e: KeyboardEvent) => {
    const handledKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Enter',
      ' ',
    ];
    if (!handledKeys.includes(e.key)) return;
    e.preventDefault();

    const current = focusedDate();

    if (e.key === 'Enter' || e.key === ' ') {
      const day = calendarDays().find((d) => d.date === current);
      if (day && !day.isDisabled) handleDayClick(day);
      return;
    }

    let newDate = current;
    const d = new Date(current + 'T00:00:00');

    switch (e.key) {
      case 'ArrowLeft':
        newDate = shiftDate(current, -1);
        break;
      case 'ArrowRight':
        newDate = shiftDate(current, 1);
        break;
      case 'ArrowUp':
        newDate = shiftDate(current, -7);
        break;
      case 'ArrowDown':
        newDate = shiftDate(current, 7);
        break;
      case 'Home': {
        const first = new Date(d.getFullYear(), d.getMonth(), 1);
        newDate = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      }
      case 'End': {
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        newDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        break;
      }
      case 'PageUp':
        newDate = shiftMonth(current, -1);
        break;
      case 'PageDown':
        newDate = shiftMonth(current, 1);
        break;
    }

    setFocusedDate(newDate);

    // Navigate calendar month if focused date is outside current month
    const nd = new Date(newDate + 'T00:00:00');
    const cm = currentMonth();
    if (nd.getFullYear() !== cm.getFullYear() || nd.getMonth() !== cm.getMonth()) {
      setCurrentMonth(new Date(nd.getFullYear(), nd.getMonth()));
    }

    // Imperatively focus the day button after DOM updates
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        `[data-testid="calendar-day-${newDate}"]`,
      );
      btn?.focus();
    });
  };

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
              aria-label={t('calendar.prevMonth')}
            >
              <ChevronLeft size={20} />
            </button>
          }
        >
          <button
            onClick={() => setPickerYear((y) => y - 1)}
            class="rounded p-2 hover:bg-hover text-primary"
            aria-label={t('calendar.prevYear')}
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
          aria-label={showPicker() ? t('calendar.closePicker') : t('calendar.openPicker')}
          aria-expanded={showPicker()}
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
              aria-label={t('calendar.nextMonth')}
            >
              <ChevronRight size={20} />
            </button>
          }
        >
          <button
            onClick={() => setPickerYear((y) => y + 1)}
            class="rounded p-2 hover:bg-hover text-primary"
            aria-label={t('calendar.nextYear')}
          >
            <ChevronRight size={20} />
          </button>
        </Show>
      </div>

      <Show
        when={showPicker()}
        fallback={
          <>
            {/* Calendar grid with ARIA grid semantics */}
            <div
              role="grid"
              aria-label={monthName()}
              class="grid grid-cols-7 gap-1"
              onKeyDown={handleGridKeyDown}
            >
              {/* Week day headers */}
              <div role="row" class="contents">
                <For each={weekDays()}>
                  {(day) => (
                    <div
                      role="columnheader"
                      aria-label={day.full}
                      class="text-center text-xs font-medium text-tertiary mb-2"
                    >
                      {day.short}
                    </div>
                  )}
                </For>
              </div>

              {/* Calendar weeks */}
              <For each={weeks()}>
                {(week) => (
                  <div role="row" class="contents">
                    <For each={week}>
                      {(day) => (
                        <div role="gridcell">
                          <button
                            data-testid={`calendar-day-${day.date}`}
                            onClick={() => handleDayClick(day)}
                            tabIndex={focusedDate() === day.date ? 0 : -1}
                            aria-selected={day.isSelected}
                            aria-current={day.isToday ? 'date' : undefined}
                            aria-label={`${formatDateLabel(day.date)}${day.hasEntry ? t('calendar.hasEntry') : ''}`}
                            class={`
                            relative h-8 w-full rounded text-sm flex flex-col items-center justify-center
                            ${day.isCurrentMonth ? 'text-primary' : 'text-muted'}
                            ${day.isToday ? 'font-bold' : ''}
                            ${day.isSelected ? 'interactive-primary' : !day.isDisabled ? 'hover:bg-hover' : ''}
                            ${day.isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                          `}
                            disabled={day.isDisabled}
                          >
                            <span aria-hidden="true">{day.day}</span>
                            {day.hasEntry && (
                              <span
                                aria-hidden="true"
                                class={`
                                h-1 w-1 rounded-full mt-0.5
                                ${day.isSelected ? 'bg-white' : 'bg-interactive'}
                              `}
                              />
                            )}
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </>
        }
      >
        {/* Month picker grid — 3×4 */}
        <div class="grid grid-cols-3 gap-1 py-1">
          <For each={MONTH_NAMES()}>
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
                aria-label={t('calendar.monthYearAria', { name, year: String(pickerYear()) })}
                aria-pressed={
                  pickerYear() === currentMonth().getFullYear() && i() === currentMonth().getMonth()
                }
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
