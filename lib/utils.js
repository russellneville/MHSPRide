import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a Date to a YYYY-MM-DD string using LOCAL time zone,
 * avoiding the UTC-shift bug that occurs with toISOString() or
 * toLocaleDateString("en-CA") in negative-offset time zones.
 */
/** Converts "HH:MM" 24-hour string to "h:mm am/pm" */
export function formatTime(t) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Converts "YYYY-MM-DD" to e.g. "Sat, Jul 26" (year included when not the current year) */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const opts = { weekday: 'short', month: 'short', day: 'numeric' }
  if (y !== new Date().getFullYear()) opts.year = 'numeric'
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}

export function toLocalDateStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
