/**
 * Shared email sending utility using Resend.
 * All notification routes import from here.
 */
import { Resend } from 'resend'
import { resolveLocation } from './locations'

const FROM = 'MHSPRide <noreply@mhspride.com>'

function rideTable(ride) {
  const rows = [
    ['Date',             ride.departure_date],
    ['Departure',        resolveLocation(ride.departure)],
    ['Departs at',       ride.departure_time],
    ride.arrival_time         ? ['Arrives at',      ride.arrival_time]         : null,
    ride.return_departure_time ? ['Return departs', ride.return_departure_time] : null,
    ['Arrival',          resolveLocation(ride.arrival)],
    ride.ride_description     ? ['Notes',           ride.ride_description]      : null,
  ].filter(Boolean)

  return `
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:4px 16px 4px 0;font-weight:600;color:#374151;white-space:nowrap">${label}</td>
          <td style="padding:4px 0;color:#111827">${value}</td>
        </tr>`).join('')}
    </table>`
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
      <p>Hi ${fullname},</p>
      <p>Your MHSPRide account is set up and ready to go.</p>
      <p>You can now join a patrol network, find rides to the mountain, and offer seats to fellow patrollers.</p>
      <p><a href="https://mhspride.com/dashboard" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Go to Dashboard</a></p>
      <p>See you on the mountain.</p>
      <p>— The MHSPRide Team</p>
    `),
  })
}

export async function sendBookingReceiptEmail({ passenger, driver, ride, bookedSeats }) {
  return sendEmail({
    to: passenger.email,
    subject: `Ride booked · ${resolveLocation(ride.departure)} → ${resolveLocation(ride.arrival)} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${passenger.fullname},</p>
      <p>You've booked <strong>${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}</strong> on the following ride:</p>
      ${rideTable(ride)}
      <p><strong>Driver:</strong> ${driver.fullname}${driver.phone ? ` · ${driver.phone}` : ''}</p>
      <p>Reach out to your driver directly if anything changes on your end.</p>
      <p><a href="https://mhspride.com/dashboard/bookings" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Bookings</a></p>
      <p>— MHSPRide</p>
    `),
  })
}

export async function sendBookingNoticeEmail({ driver, passenger, ride, bookedSeats }) {
  return sendEmail({
    to: driver.email,
    subject: `New booking · ${passenger.fullname} reserved ${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}`,
    html: layout(`
      <p>Hi ${driver.fullname},</p>
      <p><strong>${passenger.fullname}</strong> just booked <strong>${bookedSeats} seat${bookedSeats !== 1 ? 's' : ''}</strong> on your ride:</p>
      ${rideTable(ride)}
      <p><strong>Passenger contact:</strong> ${passenger.phone || 'No phone on file'} · ${passenger.email}</p>
      <p><a href="https://mhspride.com/dashboard/rides" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View My Offered Rides</a></p>
      <p>— MHSPRide</p>
    `),
  })
}

export async function sendCancellationEmail({ passenger, ride }) {
  return sendEmail({
    to: passenger.email,
    subject: `Ride canceled · ${resolveLocation(ride.departure)} → ${resolveLocation(ride.arrival)} on ${ride.departure_date}`,
    html: layout(`
      <p>Hi ${passenger.fullname},</p>
      <p>Unfortunately, the following ride has been <strong>canceled</strong> by the driver:</p>
      ${rideTable(ride)}
      <p>Head back to MHSPRide to find another ride or reach out to your network.</p>
      <p><a href="https://mhspride.com/dashboard/networks" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Find Another Ride</a></p>
      <p>— MHSPRide</p>
    `),
  })
}
