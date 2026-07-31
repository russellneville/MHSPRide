/**
 * Builds "Add to Calendar" links (Google, Outlook, .ics) for a ride.
 * All rides are Mount Hood carpools, so wall-clock times are always
 * interpreted as America/Los_Angeles regardless of where the recipient opens
 * the email.
 */
const TIMEZONE = 'America/Los_Angeles'

// Offset (ms) such that `wall clock in timeZone at `date`` == `date + offset`.
// Uses Intl.formatToParts rather than a toLocaleString/Date round-trip so the
// result doesn't depend on the host process's own local timezone.
function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  )
  return asUtc - date.getTime()
}

// Interprets a "YYYY-MM-DD" + "HH:MM" wall-clock pair as America/Los_Angeles
// and returns the equivalent UTC instant, handling DST automatically.
function zonedTimeToUtc(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  const offsetMs = getTimeZoneOffsetMs(utcGuess, TIMEZONE)
  return new Date(utcGuess.getTime() - offsetMs)
}

export function buildRideCalendarEvent({ departureName, arrivalName, departureDate, departureTime, arrivalTime, returnDepartureTime, notes }) {
  const start = zonedTimeToUtc(departureDate, departureTime)
  let end = arrivalTime ? zonedTimeToUtc(departureDate, arrivalTime) : null
  if (!end || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000)

  const descriptionLines = [`MHSPRide carpool: ${departureName} to ${arrivalName}.`]
  if (returnDepartureTime) descriptionLines.push(`Return departs at ${returnDepartureTime}.`)
  if (notes) descriptionLines.push(notes)

  return {
    title: `Ride: ${departureName} → ${arrivalName}`,
    description: descriptionLines.join('\n'),
    // Meeting point is the departure location — where the rider needs to be
    // when the event starts — not a combined "X to Y" string, which map
    // providers can't resolve to a single point.
    location: departureName,
    start,
    end,
  }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function toUtcStamp(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

export function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toUtcStamp(event.start)}/${toUtcStamp(event.end)}`,
    details: event.description,
    location: event.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrl(event) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: event.description,
    location: event.location,
  })
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function icsCalendarUrl(event) {
  const params = new URLSearchParams({
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  })
  return `https://mhspride.com/api/calendar/event.ics?${params.toString()}`
}

function escapeIcsText(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// Folds a content line at 75 octets per RFC 5545 (continuation lines start
// with a single space) so long descriptions/locations don't break parsers.
function foldIcsLine(line) {
  if (line.length <= 75) return line
  const chunks = []
  let rest = line
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75))
    rest = rest.slice(75)
  }
  chunks.push(rest)
  return chunks.join('\r\n ')
}

export function icsFileContent({ title, description, location, start, end }) {
  const dtstart = toUtcStamp(new Date(start))
  const dtend = toUtcStamp(new Date(end))
  const dtstamp = toUtcStamp(new Date())
  const uid = `${dtstart}-${Math.random().toString(36).slice(2)}@mhspride.com`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MHSPRide//Ride Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldIcsLine).join('\r\n') + '\r\n'
}
