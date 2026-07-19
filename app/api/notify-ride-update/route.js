import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { passengers, ride } = await request.json()

    if (!passengers?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const results = await Promise.allSettled(
      passengers.map(p =>
        resend.emails.send({
          from: 'MHSPRide <noreply@mhspride.com>',
          to: p.email,
          subject: 'A ride you booked has been updated',
          html: `
            <p>Hi ${esc(p.fullname)},</p>
            <p>The driver has updated a ride you booked. Here are the new details:</p>
            <table style="border-collapse:collapse;margin:12px 0">
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Departure</td><td>${esc(ride.departure)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Arrival</td><td>${esc(ride.arrival)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Date</td><td>${esc(ride.departure_date)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Departure time</td><td>${esc(ride.departure_time)}</td></tr>
              ${ride.arrival_time ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Arrival time</td><td>${esc(ride.arrival_time)}</td></tr>` : ''}
              ${ride.return_departure_time ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Return departs</td><td>${esc(ride.return_departure_time)}</td></tr>` : ''}
              ${ride.ride_description ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Notes</td><td>${esc(ride.ride_description)}</td></tr>` : ''}
            </table>
            <p>Please confirm the updated details with your driver. If these changes don't work for you, contact the driver directly.</p>
            <p>— MHSPRide</p>
          `,
        })
      )
    )

    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[notify-ride-update] ${passengers[i]?.email} failed:`, r.reason)
    })

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-ride-update]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
