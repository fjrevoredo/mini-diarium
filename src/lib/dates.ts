/**
 * Formats a date string (YYYY-MM-DD) to a readable format
 * Example: "2024-01-15" -> "Monday, January 15, 2024"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Gets the current date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
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
