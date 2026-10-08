/**
 * dateUtils.ts
 * Timezone-aware local date helpers ensuring calendar dates are formatted
 * in local time (e.g. Asia/Karachi UTC+5) without shifting night deliveries to the previous day.
 */

/**
 * Returns today's date in local YYYY-MM-DD format.
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a timestamp (ms) or Date instance into local YYYY-MM-DD format.
 */
export function toLocalDateString(msOrDate?: number | Date | string | null): string {
  if (!msOrDate) return getTodayDateString();
  const d = typeof msOrDate === 'number' || typeof msOrDate === 'string' ? new Date(msOrDate) : msOrDate;
  if (isNaN(d.getTime())) return getTodayDateString();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
