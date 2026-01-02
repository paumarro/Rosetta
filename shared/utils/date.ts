/** Formats ISO date string to "D Mon YYYY" format (e.g., "1 Jan 2025") */
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

/** Checks if a date falls within the last N days from now */
export function isWithinDays(dateString: string, days: number): boolean {
  const date = new Date(dateString);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return date.getTime() > cutoff;
}

/** Checks if item is "new" (created within last 7 days) */
export function isNew(createdAt: string): boolean {
  return isWithinDays(createdAt, 7);
}

/** Sorts items by updatedAt in descending order (newest first) */
export function sortByDate<T extends { updatedAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
