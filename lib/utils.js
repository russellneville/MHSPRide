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
export function toLocalDateStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
