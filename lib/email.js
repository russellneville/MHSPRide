/**
 * Shared email sending utility using Resend.
 * All notification routes import from here.
 */
import { Resend } from 'resend'
import { resolveLocationServer } from './serverLocations'
import { buildRideCalendarEvent, googleCalendarUrl, outlookCalendarUrl, icsCalendarUrl } from './calendarLinks'
import { formatDate, formatTime } from './utils'
import { IS_TEST_ENV, SITE_URL } from './siteUrl'

const FROM = `MHSP Ride${IS_TEST_ENV ? ' - TEST' : ''} <noreply@mhspride.com>`

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// highlightFields (optional) bolds specific rows' values — used by
// sendRideRequestFulfilledEmail to call out which requested details a
// driver changed. Every other caller omits it, so this is a no-op there.
async function rideTable(ride, highlightFields = []) {
  const [departure, arrival] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
  ])
  const rows = [
    ['Date',             ride.departure_date, 'departure_date'],
    ['Departure',        departure, 'departure'],
    ['Departs at',       ride.departure_time, 'departure_time'],
    ride.arrival_time         ? ['Arrives at',      ride.arrival_time, 'arrival_time']         : null,
    ride.return_departure_time ? ['Return departs', ride.return_departure_time, 'return_departure_time'] : null,
    ['Arrival',          arrival, 'arrival'],
    ride.ride_description     ? ['Notes',           ride.ride_description, 'ride_description']      : null,
  ].filter(Boolean)

  return `
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
      ${rows.map(([label, value, field]) => `
        <tr>
          <td style="padding:4px 16px 4px 0;font-weight:600;color:#374151;white-space:nowrap">${esc(label)}</td>
          <td style="padding:4px 0;color:#111827;${highlightFields.includes(field) ? 'font-weight:700' : ''}">${esc(value)}</td>
        </tr>`).join('')}
    </table>`
}

function calendarLinksRow(departureName, arrivalName, ride) {
  const event = buildRideCalendarEvent({
    departureName,
    arrivalName,
    departureDate: ride.departure_date,
    departureTime: ride.departure_time,
    arrivalTime: ride.arrival_time,
    returnDepartureTime: ride.return_departure_time,
    notes: ride.ride_description,
  })
  return `
    <p style="font-size:13px;color:#6b7280">
      Add to calendar:
      <a href="${esc(googleCalendarUrl(event))}">Google</a> ·
      <a href="${esc(outlookCalendarUrl(event))}">Outlook</a> ·
      <a href="${esc(icsCalendarUrl(event))}">Apple / other (.ics)</a>
    </p>`
}

function layout(body) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;font-size:15px;color:#111827;max-width:560px;margin:0 auto;padding:24px">
      <p style="font-size:18px;font-weight:700;color:#1d4ed8;margin:0 0 20px">MHSP Ride</p>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="font-size:12px;color:#9ca3af">
        MHSP Ride · Mount Hood Ski Patrol Carpooling<br/>
        Questions? Reply to your driver or passenger directly.
      </p>
    </body>
    </html>`
}

export async function sendEmail({ to, subject, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  return resend.emails.send({ from: FROM, to, subject, html })
}

export async function sendRegistrationEmail({ email, fullname }) {
  return sendEmail({
    to: email,
    subject: 'Welcome to MHSP Ride',
    html: layout(`
      <p>Hi ${esc(fullname)},</p>
      <p>Your MHSP Ride account is set up and ready to go.</p>
      <p>You can now join a patrol network, find rides to the mountain, and offer seats to fellow patrollers.</p>
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Dashboard</a></p>
      <p>See you on the mountain.</p>
      <p>— The MHSP Ride Team</p>
    `),
  })
}

export async function sendBookingReceiptEmail({ passenger, driver, ride, bookedSeats }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
    rideTable(ride),
  ])
  return sendEmail({
    to: passenger.email,
    subject: `Ride booked · ${departure} → ${arrival} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${esc(passenger.fullname)},</p>
      <p>You've booked <strong>${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}</strong> on the following ride:</p>
      ${table}
      <p><strong>Driver:</strong> ${esc(driver.fullname)}${driver.phone ? ` · ${esc(driver.phone)}` : ''}</p>
      <p>Reach out to your driver directly if anything changes on your end.</p>
      ${calendarLinksRow(departure, arrival, ride)}
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendBookingNoticeEmail({ driver, passenger, ride, bookedSeats }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
    rideTable(ride),
  ])
  return sendEmail({
    to: driver.email,
    subject: `New booking · ${passenger.fullname} reserved ${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}`,
    html: layout(`
      <p>Hi ${esc(driver.fullname)},</p>
      <p><strong>${esc(passenger.fullname)}</strong> just booked <strong>${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}</strong> on your ride:</p>
      ${table}
      <p><strong>Passenger contact:</strong> ${esc(passenger.phone) || 'No phone on file'} · ${esc(passenger.email)}</p>
      ${calendarLinksRow(departure, arrival, ride)}
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendSupportEmail({ name, email, message, to }) {
  return sendEmail({
    to,
    subject: `Support request from ${name}`,
    html: layout(`
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Message:</strong></p>
      <p style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;border-radius:4px;white-space:pre-wrap">${esc(message)}</p>
      <p style="font-size:13px;color:#6b7280">Reply directly to <a href="mailto:${esc(email)}">${esc(email)}</a> to respond.</p>
    `),
  })
}

export async function sendPasswordResetEmail({ email, link, adminInitiated }) {
  return sendEmail({
    to: email,
    subject: 'Reset your MHSP Ride password',
    html: layout(`
      <p>Hi,</p>
      <p>${adminInitiated
        ? 'An administrator has reset the password for this account. Click below to choose a new password:'
        : 'Someone requested a password reset for this account. Click below to choose a new password:'}</p>
      <p><a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a></p>
      <p>${adminInitiated
        ? "If you weren't expecting this, contact your network administrator."
        : "If you didn't request this, you can safely ignore this email."}</p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendRegistrationCodeEmail({ email, code }) {
  return sendEmail({
    to: email,
    subject: 'Your MHSP Ride verification code',
    html: layout(`
      <p>Hi,</p>
      <p>Use this code to verify your MHSP membership and continue creating your MHSP Ride account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#1d4ed8;margin:20px 0">${code}</p>
      <p>This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendSuspensionEmail({ email, fullname }) {
  return sendEmail({
    to: email,
    subject: 'Your MHSP Ride account has been suspended',
    html: layout(`
      <p>Hi ${esc(fullname)},</p>
      <p>Your MHSP Ride account has been suspended. You will not be able to log in until this is resolved.</p>
      <p>Please contact an MHSP Ride admin for more information.</p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendReinstatementEmail({ email, fullname }) {
  return sendEmail({
    to: email,
    subject: 'Your MHSP Ride account has been reinstated',
    html: layout(`
      <p>Hi ${esc(fullname)},</p>
      <p>Your MHSP Ride account has been reinstated. You can log back in now.</p>
      <p><a href="${SITE_URL}/login" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Login</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendBookingCanceledByPassengerEmail({ driver, passenger, ride, bookedSeats, reason }) {
  const table = await rideTable(ride)
  return sendEmail({
    to: driver.email,
    subject: `Booking canceled · ${passenger.fullname} released ${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}`,
    html: layout(`
      <p>Hi ${esc(driver.fullname)},</p>
      <p><strong>${esc(passenger.fullname)}</strong> has canceled their booking on your ride, freeing up <strong>${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}</strong>:</p>
      ${table}
      ${reason ? `<p><strong>Reason given:</strong> ${esc(reason)}</p>` : ''}
      <p><strong>Passenger contact:</strong> ${esc(passenger.phone) || 'No phone on file'} · ${esc(passenger.email)}</p>
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendBookingCanceledConfirmationEmail({ passenger, ride, reason }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
    rideTable(ride),
  ])
  return sendEmail({
    to: passenger.email,
    subject: `Booking canceled · ${departure} → ${arrival} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${esc(passenger.fullname)},</p>
      <p>Your booking on the following ride has been <strong>canceled</strong>:</p>
      ${table}
      ${reason ? `<p><strong>Reason given:</strong> ${esc(reason)}</p>` : ''}
      <p>Head back to MHSP Ride if you'd like to find another ride.</p>
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Find Another Ride</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendFeedbackResponseEmail({ email, name, originalMessage, response }) {
  return sendEmail({
    to: email,
    subject: 'Response to your MHSP Ride feedback',
    html: layout(`
      <p>Hi ${esc(name) || 'there'},</p>
      <p>An MHSP Ride admin has responded to the feedback you submitted:</p>
      <p style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;border-radius:4px;white-space:pre-wrap">${esc(response)}</p>
      <p style="font-size:13px;color:#6b7280">Your original message:</p>
      <p style="font-size:13px;color:#6b7280;background:#f9fafb;padding:10px 14px;border-radius:4px;white-space:pre-wrap">${esc(originalMessage)}</p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendCancellationEmail({ passenger, ride }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
    rideTable(ride),
  ])
  return sendEmail({
    to: passenger.email,
    subject: `Ride canceled · ${departure} → ${arrival} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${esc(passenger.fullname)},</p>
      <p>Unfortunately, the following ride has been <strong>canceled</strong> by the driver:</p>
      ${table}
      ${ride.cancellation_reason ? `<p><strong>Reason given:</strong> ${esc(ride.cancellation_reason)}</p>` : ''}
      <p>Head back to MHSP Ride to find another ride or reach out to your network.</p>
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Find Another Ride</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

async function requestTable(request) {
  const [departure, arrival] = await Promise.all([
    resolveLocationServer(request.departure),
    resolveLocationServer(request.arrival),
  ])
  const rows = [
    ['Date',        request.departure_date],
    ['Departure',   departure],
    ['Departs at',  request.departure_time],
    ['Arrival',     arrival],
    ['Seats',       request.seats_requested],
    request.notes ? ['Notes', request.notes] : null,
  ].filter(Boolean)

  return `
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:4px 16px 4px 0;font-weight:600;color:#374151;white-space:nowrap">${esc(label)}</td>
          <td style="padding:4px 0;color:#111827">${esc(value)}</td>
        </tr>`).join('')}
    </table>`
}

// Admin-initiated cancellation only — a rider canceling their own request
// already knows it's canceled, so no email fires for that path.
export async function sendRideRequestCanceledEmail({ requester, request }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(request.departure),
    resolveLocationServer(request.arrival),
    requestTable(request),
  ])
  return sendEmail({
    to: requester.email,
    subject: `Ride request canceled · ${departure} → ${arrival} on ${request.departure_date}`,
    html: layout(`
      <p>Hi ${esc(requester.fullname)},</p>
      <p>An MHSP Ride admin has <strong>canceled</strong> your ride request:</p>
      ${table}
      <p>Head back to MHSP Ride if you'd like to submit a new request.</p>
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Dashboard</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

// Sent by the hourly expiry cron (app/api/cron/expire-ride-requests) when a
// request goes unclaimed until 6h before its requested time.
export async function sendRideRequestExpiredEmail({ requester, request }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(request.departure),
    resolveLocationServer(request.arrival),
    requestTable(request),
  ])
  return sendEmail({
    to: requester.email,
    subject: `Ride request expired · ${departure} → ${arrival} on ${request.departure_date}`,
    html: layout(`
      <p>Hi ${esc(requester.fullname)},</p>
      <p>Unfortunately, no driver claimed your ride request in time and it has <strong>expired</strong>:</p>
      ${table}
      <p>Head back to MHSP Ride if you'd like to submit a new request.</p>
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Dashboard</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

// Resolves a diffPrefilledFields() entry's raw values into display strings —
// departure/arrival are location ids (resolve to names), the date/time
// fields are already-formatted-enough raw strings that just need the same
// formatDate/formatTime treatment used elsewhere in this file.
async function formatDiffValue(field, value) {
  if (field === 'departure' || field === 'arrival') return resolveLocationServer(value)
  if (field === 'departure_date') return formatDate(value)
  if (field === 'departure_time') return formatTime(value)
  return value
}

async function formatDiffs(diffs) {
  return Promise.all(diffs.map(async (d) => ({
    label: d.label,
    oldValue: await formatDiffValue(d.field, d.oldValue),
    newValue: await formatDiffValue(d.field, d.newValue),
  })))
}

// Sent when a driver fulfills a ride request (app/api/ride-requests/fulfill).
// deepLink points at the new ride's own details page — every other email in
// this file links to the generic /dashboard, but a fulfilled request is
// exactly one ride, so a direct link is worth the one-off.
export async function sendRideRequestFulfilledEmail({ requester, driver, ride, diffs, seatsShortfall, deepLink }) {
  // Bold whichever table rows actually changed from the request — plus the
  // Notes row itself, since notes only ever get filled in to explain a
  // change (see the notes-required validation in OfferRidePopup.jsx).
  const highlightFields = diffs.map(d => d.field)
  if (diffs.length > 0) highlightFields.push('ride_description')

  const [departure, arrival, table, formattedDiffs] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
    rideTable(ride, highlightFields),
    formatDiffs(diffs),
  ])

  const changesBlock = formattedDiffs.length > 0 ? `
    <p><strong>NOTE, the driver has changed the following requested ride details:</strong></p>
    <ul style="margin:4px 0 16px;padding-left:20px">
      ${formattedDiffs.map(d => `<li><strong>${esc(d.label.toUpperCase())}:</strong> ${esc(d.oldValue)} &rarr; ${esc(d.newValue)}</li>`).join('')}
    </ul>` : ''

  const shortfallBlock = seatsShortfall ? `
    <p>Note: only ${ride.total_seats} seat${ride.total_seats !== 1 ? 's' : ''} ${ride.total_seats !== 1 ? 'were' : 'was'} available on this ride, fewer than you originally requested.</p>` : ''

  return sendEmail({
    to: requester.email,
    subject: `Ride request fulfilled · ${departure} → ${arrival} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${esc(requester.fullname)},</p>
      <p>Great news, your ride request has been accepted by <strong>${esc(driver.fullname)}</strong>!</p>
      ${changesBlock}
      ${table}
      ${shortfallBlock}
      ${calendarLinksRow(departure, arrival, ride)}
      <p><a href="${esc(deepLink)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Ride Details</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}

export async function sendRideUpdateEmail({ passenger, ride }) {
  const [departure, arrival, table] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
    rideTable(ride),
  ])
  return sendEmail({
    to: passenger.email,
    subject: `Ride updated · ${departure} → ${arrival} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${esc(passenger.fullname)},</p>
      <p>The driver has updated a ride you booked. Here are the new details:</p>
      ${table}
      <p>Please confirm the updated details with your driver. If these changes don't work for you, contact the driver directly.</p>
      ${calendarLinksRow(departure, arrival, ride)}
      <p><a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSP Ride</p>
    `),
  })
}
