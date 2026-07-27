/**
 * Formats a date string (YYYY-MM-DD) to a readable format
 * Example: "2024-01-15" -> "Monday, January 15, 2024"
 */
export function formatDate(dateStr: string, locale?: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(locale ?? 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Date presentation styles offered for the timeline row date (TODO-0072).
 * 'full' reproduces formatDate() exactly; 'iso' is intentionally locale-independent.
 */
export type DateFormatStyle = 'full' | 'long' | 'medium' | 'short' | 'iso';

/**
 * Formats a date string (YYYY-MM-DD) using one of the presentation styles above.
 *
 * `dateStyle` must never be combined with individual component options (Intl throws
 * a TypeError), so 'full' delegates to formatDate() — its explicit option bag is the
 * contract for the default, and CLDR does not guarantee the two agree in every locale.
 */
export function formatDateWithStyle(
  dateStr: string,
  style: DateFormatStyle,
  locale?: string,
): string {
  if (style === 'iso') return dateStr;
  if (style === 'full') return formatDate(dateStr, locale);
  const date = new Date(dateStr + 'T00:00:00');
  try {
    return date.toLocaleDateString(locale ?? 'en-US', { dateStyle: style });
  } catch {
    // A corrupted preferences.language would make Intl throw RangeError — never blank the row.
    return date.toLocaleDateString('en-US', { dateStyle: style });
  }
}

/**
 * Gets the current date in YYYY-MM-DD format (in local timezone)
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a date string is valid
 */
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
}

/**
 * Gets ISO timestamp for current time
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Add days to a date string (YYYY-MM-DD)
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add months to a date string (YYYY-MM-DD)
 */
export function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO 8601 timestamp string using the OS/browser locale.
 * Example: "2024-01-15T14:30:00.000Z" -> "Jan 15, 2024, 2:30 PM"
 */
export function formatTimestamp(isoString: string, locale?: string): string {
  return new Date(isoString).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
