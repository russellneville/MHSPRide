'use client'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function QA({ q, children }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-foreground">{q}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  )
}

export default function FaqPage() {
  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            How MHSPRide works, for riders and drivers.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <QA q="What is MHSPRide?">
              MHSPRide connects Mount Hood Ski Patrol volunteers for carpooling to and from the mountain.
              It's organized around three networks — Hill Patrol, Mountain Hosts, and Nordic — each with its
              own pool of offered rides. You can join one or more networks under Book/Offer Rides.
            </QA>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For Riders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QA q="How do I book a ride?">
              Join a network, browse its upcoming rides, and choose how many seats to reserve. Booking is
              instant — there's no approval step, as long as seats are available.
            </QA>
            <QA q="Is there a cutoff for booking a ride?">
              Yes. Bookings close 6 hours before a ride's departure time. Once you're inside that window,
              the booking option is no longer available for that ride.
            </QA>
            <QA q="Can I book more than one ride on the same day?">
              No — only one active (non-canceled) booking per calendar day is allowed. If you try to book a
              second ride on a day you're already booked, you'll be blocked with a reminder.
            </QA>
            <QA q="Can I cancel a booking, and is there a deadline?">
              You can cancel your own booking at any time — there's no hard cutoff. You'll always be asked
              for a short reason for the cancellation, which is included in the email sent to your driver.
              If you cancel within 12 hours of departure, you'll also see a one-time reminder to call or
              text your driver directly, since email alone may not reach them in time.
            </QA>
            <QA q="What happens if my driver cancels the ride?">
              Your booking is automatically canceled along with the rest of the ride, and you'll get a
              cancellation email (including the driver's reason, if they gave one).
            </QA>
            <QA q="What do the ride statuses mean?">
              Not Started, In Progress, and Completed are calculated automatically from the ride's scheduled
              departure and arrival/return times — nobody manually marks a ride as started or finished.
              Canceled means the driver or an admin canceled it.
            </QA>
            <QA q="How accurate are the arrival times shown?">
              Arrival times are estimated from typical drive times and do not account for traffic, weather,
              or road conditions. Treat them as a rough guide, not a guarantee.
            </QA>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For Drivers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QA q="How do I offer a ride?">
              From a network's ride list, offer a ride with your departure and arrival locations, date and
              time, number of seats, and optional notes for riders. Rides can be one-way or round trip (with
              a return departure time).
            </QA>
            <QA q="Can I edit a ride after people have booked it?">
              Yes. Booked riders are notified by email automatically when you make changes, but you should
              still reach out to them directly — an email isn't a guarantee they'll see it in time, especially
              close to departure.
            </QA>
            <QA q="What happens when I cancel a ride?">
              Canceling a ride cancels every booking on it. You'll be asked for a cancellation reason, and
              every booked rider gets a cancellation email that includes it. Unlike a rider canceling their
              own seat, there's no separate short-notice step for drivers — a ride can have multiple riders,
              so there's no single "other party" to call.
            </QA>
            <QA q="Does anyone approve or manage my ride's status?">
              No. Whether a ride shows as Not Started, In Progress, or Completed is calculated automatically
              from its scheduled times — you don't need to (and can't) mark it manually.
            </QA>
            <QA q="What vehicle information do riders see?">
              Whatever you've filled in on your profile — make, model, year, color, license plate, and seat
              count — so riders know what to look for.
            </QA>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Using MHSPRide means agreeing to its Terms of Use, including that the site may only be used through
          the interfaces it provides — attempts to script, automate, or otherwise interfere with the site are
          grounds for account suspension.
        </p>

        <Button href="/dashboard">Continue to Dashboard</Button>
      </div>
    </DashboardLayout>
  )
}
