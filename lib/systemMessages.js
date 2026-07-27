// Pure helpers for the system message banner (issue #106), shared by the
// admin API routes (server-side validation) and the client (banner display,
// admin table status badges).

export const SEVERITIES = ['info', 'warning', 'urgent']

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

// Status is purely a function of the time window — there's no separate
// enable/disable flag, so editing the end date is how an admin "deactivates"
// a message early.
export function getMessageStatus(startAt, endAt, now = new Date()) {
  if (now < startAt) return 'upcoming'
  if (now > endAt) return 'expired'
  return 'active'
}

// Non-overlap is enforced across ALL messages regardless of show_on_login,
// since every message always shows on the dashboard — two overlapping
// windows would mean two banners competing for the same dashboard slot.
export function findOverlapping(messages, startAt, endAt, excludeId = null) {
  return messages.find(m => m.id !== excludeId && rangesOverlap(startAt, endAt, m.start_at, m.end_at)) || null
}

export function findActiveMessage(messages, { now = new Date(), loginOnly = false } = {}) {
  return messages.find(m => {
    if (loginOnly && !m.show_on_login) return false
    return getMessageStatus(m.start_at, m.end_at, now) === 'active'
  }) || null
}
