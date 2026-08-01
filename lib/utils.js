import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Shared character cap for free-text Textarea inputs across the app. */
export const TEXTAREA_MAX_LENGTH = 250;

/** Shared character caps for common text inputs across the app. */
export const NAME_MAX_LENGTH = 50;
export const PHONE_MAX_LENGTH = 20;
export const MHSP_NUMBER_MAX_LENGTH = 10;
export const LOCATION_NAME_MAX_LENGTH = 60;
// RFC 5321's 320-char max total address length — also enforced server-side
// by isValidEmailInput() in lib/rateLimit.js.
export const EMAIL_MAX_LENGTH = 320;

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

/**
 * Formats digits as a US phone number while typing, e.g. "5035551234" -> "(503) 555-1234".
 * Mobile browsers restrict the `type="tel"` keypad to digits, so this lets users enter
 * plain digits and still end up with a readable formatted number.
 */
export function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function toLocalDateStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
