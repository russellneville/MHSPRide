/**
 * Shared email sending utility using Resend.
 * All notification routes import from here.
 */
import { Resend } from 'resend'
import { resolveLocationServer } from './serverLocations'
import { buildRideCalendarEvent, googleCalendarUrl, outlookCalendarUrl, icsCalendarUrl } from './calendarLinks'

const FROM = 'MHSPRide <noreply@mhspride.com>'

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function rideTable(ride) {
  const [departure, arrival] = await Promise.all([
    resolveLocationServer(ride.departure),
    resolveLocationServer(ride.arrival),
  ])
  const rows = [
    ['Date',             ride.departure_date],
    ['Departure',        departure],
    ['Departs at',       ride.departure_time],
    ride.arrival_time         ? ['Arrives at',      ride.arrival_time]         : null,
    ride.return_departure_time ? ['Return departs', ride.return_departure_time] : null,
    ['Arrival',          arrival],
    ride.ride_description     ? ['Notes',           ride.ride_description]      : null,
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
      <p style="font-size:18px;font-weight:700;color:#1d4ed8;margin:0 0 20px">MHSPRide</p>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="font-size:12px;color:#9ca3af">
        MHSPRide · Mount Hood Ski Patrol Carpooling<br/>
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
    subject: 'Welcome to MHSPRide',
    html: layout(`
      <p>Hi ${esc(fullname)},</p>
      <p>Your MHSPRide account is set up and ready to go.</p>
      <p>You can now join a patrol network, find rides to the mountain, and offer seats to fellow patrollers.</p>
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Dashboard</a></p>
      <p>See you on the mountain.</p>
      <p>— The MHSPRide Team</p>
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
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSPRide</p>
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
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSPRide</p>
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
    subject: 'Reset your MHSPRide password',
    html: layout(`
      <p>Hi,</p>
      <p>${adminInitiated
        ? 'An administrator has reset the password for this account. Click below to choose a new password:'
        : 'Someone requested a password reset for this account. Click below to choose a new password:'}</p>
      <p><a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a></p>
      <p>${adminInitiated
        ? "If you weren't expecting this, contact your network administrator."
        : "If you didn't request this, you can safely ignore this email."}</p>
      <p>— MHSPRide</p>
    `),
  })
}

export async function sendRegistrationCodeEmail({ email, code }) {
  return sendEmail({
    to: email,
    subject: 'Your MHSPRide verification code',
    html: layout(`
      <p>Hi,</p>
      <p>Use this code to verify your MHSP membership and continue creating your MHSPRide account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#1d4ed8;margin:20px 0">${code}</p>
      <p>This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      <p>— MHSPRide</p>
    `),
  })
}

export async function sendSuspensionEmail({ email, fullname }) {
  return sendEmail({
    to: email,
    subject: 'Your MHSPRide account has been suspended',
    html: layout(`
      <p>Hi ${esc(fullname)},</p>
      <p>Your MHSPRide account has been suspended. You will not be able to log in until this is resolved.</p>
      <p>Please contact an MHSPRide admin for more information.</p>
      <p>— MHSPRide</p>
    `),
  })
}

export async function sendReinstatementEmail({ email, fullname }) {
  return sendEmail({
    to: email,
    subject: 'Your MHSPRide account has been reinstated',
    html: layout(`
      <p>Hi ${esc(fullname)},</p>
      <p>Your MHSPRide account has been reinstated. You can log back in now.</p>
      <p><a href="https://mhspride.com/login" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Login</a></p>
      <p>— MHSPRide</p>
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
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSPRide</p>
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
      <p>Head back to MHSPRide if you'd like to find another ride.</p>
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Find Another Ride</a></p>
      <p>— MHSPRide</p>
    `),
  })
}

export async function sendFeedbackResponseEmail({ email, name, originalMessage, response }) {
  return sendEmail({
    to: email,
    subject: 'Response to your MHSPRide feedback',
    html: layout(`
      <p>Hi ${esc(name) || 'there'},</p>
      <p>An MHSPRide admin has responded to the feedback you submitted:</p>
      <p style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;border-radius:4px;white-space:pre-wrap">${esc(response)}</p>
      <p style="font-size:13px;color:#6b7280">Your original message:</p>
      <p style="font-size:13px;color:#6b7280;background:#f9fafb;padding:10px 14px;border-radius:4px;white-space:pre-wrap">${esc(originalMessage)}</p>
      <p>— MHSPRide</p>
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
      <p>Head back to MHSPRide to find another ride or reach out to your network.</p>
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Find Another Ride</a></p>
      <p>— MHSPRide</p>
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
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Rides</a></p>
      <p>— MHSPRide</p>
    `),
  })
}
