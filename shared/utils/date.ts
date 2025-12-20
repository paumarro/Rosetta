/**
 * Centralized date formatting utilities
 */

/**
 * Format date as "1 Jan 2025"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
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
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${String(day)} ${month} ${String(year)}`;
}

/**
 * Check if a date is within the last N days
 */
export function isWithinDays(dateString: string, days: number): boolean {
  const date = new Date(dateString);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return date.getTime() > cutoff;
}

/**
 * Check if a learning path is new (created within last 7 days)
 */
export function isNew(createdAt: string): boolean {
  return isWithinDays(createdAt, 7);
}

/**
 * Sort items by date field (newest first)
 */
export function sortByDate<T extends { updatedAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
