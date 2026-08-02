'use client'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NETWORKS } from '@/lib/networks'
import Link from 'next/link'

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              How MHSP Ride works, for riders and drivers.
            </p>
          </div>
          <Button href="/dashboard" className="shrink-0">Continue to Dashboard</Button>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <QA q="What's new in MHSP Ride?">
              See the{' '}
              <Link href="/dashboard/release-notes" className="text-foreground underline">
                Release Notes
              </Link>{' '}
              page for a running log of features added in each tagged version.
            </QA>
            <QA q="What is MHSP Ride?">
              MHSP Ride connects Mount Hood Ski Patrol volunteers for carpooling to and from the mountain.
              It's organized around {NETWORKS.length} networks — {NETWORKS.map(n => n.name).join(', ')} — each with its
              own pool of offered rides. Favorite the networks you want to see on your dashboard; you can change your favorites anytime.
            </QA>
            <QA q="Is there a cost to use MHSP Ride?">
              The app is completely free with no ads, no subscriptions, and no catch. This group of
              dedicated folks give so much of their time and effort and I wanted to contribute to help our
              MHSP community out.
            </QA>
            <QA q="Who can create an MHSP Ride account?">
              Registration is limited to eligible MHSP members whose MHSP number, last name, and Troopiter
              email match the roster. A verification code is sent to the Troopiter address, and registrants
              must confirm that they are eighteen or older and accept the Terms of Use.
            </QA>
            <QA q="What personal information does MHSP Ride collect, and why?">
              MHSP Ride stores membership identifiers, name, login email, phone, home address, profile
              information, vehicles, network preferences, rides, bookings, requests, feedback, badges, and
              relevant activity records to verify membership and operate the carpool service. Profile photos
              are stored in Firebase Storage, and production analytics may be processed through Google
              Analytics according to your consent selection.
            </QA>
            <QA q="Does MHSP Ride use cookies or analytics?">
              Essential browser storage supports application operation and preference state. In production,
              Google Analytics is enabled unless you choose the analytics opt-out option; advertising storage
              and personalization are denied.
            </QA>
            <QA q="Who can see my phone number, email, address, and vehicle information?">
              To use the app, you must be an MHSP member. Drivers and passengers receive one another's
              contact details in relevant booking emails, admins can access member records, and authenticated
              members can read ride and open-request details.
            </QA>
            <QA q="Do you share my information or plan to monetize me in some way?">
              Nope! This app was developed with the Golden Rule: treat others like I'd like to be treated,
              and I don't want to be monetized.
            </QA>
            <QA q="How secure is my information?">
              The application was developed with OWASP security standards and has been through multiple
              security scans for both client and server vulnerabilities. I will make every effort to keep
              the application secure and vulnerability free. Your information is available to other MHSP
              members — only enter information you are comfortable sharing with this community.
            </QA>
            <QA q="Does MHSP Ride send text or push notifications?">
              No. MHSP Ride currently sends email; phone numbers are used so drivers and riders can contact
              one another directly.
            </QA>
            <QA q="Does MHSP Ride screen drivers or guarantee a ride?">
              No. MHSP Ride is a voluntary coordination tool for the MHSP community, not a transportation
              provider. Members should verify people they do not recognize, confirm plans directly, use
              reasonable safety judgment, and call emergency services — not the application — during an
              emergency.
            </QA>
            <QA q="Is MHSP Ride a mobile app?">
              MHSP Ride is currently a responsive web application used through a browser on phones, tablets,
              and computers. There is no separate native iOS or Android application, and browser use does not
              currently provide MHSP Ride push notifications.
            </QA>
            <QA q="Can I choose which notifications I receive?">
              Ride and account emails do not currently have per-category opt-out controls because they
              communicate actions that affect bookings or account access. Badge celebrations can be hidden
              from Profile, but badges continue to be tracked. Broader email preferences are not currently
              implemented.
            </QA>
            <QA q="What are achievement badges, and can I turn them off?">
              Badges recognize registration, rides, driving, favorites, profile activity, requests, and other
              milestones. You can hide badge displays and celebration notifications from Profile, but badge
              evaluation and award tracking continue in the background; showing them again may reveal badges
              earned while hidden.
            </QA>
            <QA q="How many badges are there to earn?">
              There are over 50 badges that can be earned.
            </QA>
            <QA q="Can I help out as an application Admin?">
              Reach out via the Feedback widget or the{' '}
              <Link href="/contact" className="text-foreground underline">
                Contact Us
              </Link>{' '}
              form and let's chat!
            </QA>
            <QA q="I'm a software/UX professional with mad skills and would like to contribute to the code. Can I?">
              Reach out via the Feedback widget or the{' '}
              <Link href="/contact" className="text-foreground underline">
                Contact Us
              </Link>{' '}
              form and let's chat!
            </QA>
            <QA q="How do I update or delete my account and personal data?">
              You can update your profile and change your email or password from the account security area;
              email and password changes require your current password. The current application does not
              expose a self-service account-deletion or data-export control. Send deletion requests via the
              Feedback widget or{' '}
              <Link href="/contact" className="text-foreground underline">
                Contact Us
              </Link>.
            </QA>
            <QA q="What happens when the site is in maintenance mode?">
              Maintenance mode logs out and blocks standard members while allowing administrators to remain
              signed in; registration is also disabled.
            </QA>
            <QA q="What happens if my account is suspended?">
              A suspended account cannot log in until an administrator reinstates it, and you'll receive an
              email about the account action.
            </QA>
            <QA q="How do calendar links work?">
              Booking receipts, booking notices, ride updates, and fulfilled-request messages can include
              Google Calendar, Outlook, and .ics links. The calendar entry uses the pickup point as its
              location. Later ride changes don't necessarily update an event you already added, so compare it
              with the current ride details and update your calendar if necessary.
            </QA>
            <QA q="What does favoriting a network do?">
              Favoriting a network controls which ride pools appear on your dashboard and in what order —
              it's not a separate membership or approval process. Initial favorites may come from your
              Troopiter classification, and you can reorder or change them later.
            </QA>
            <QA q="Who created this site? What's the deal?">
              I'm Russell Neville, an MHSP Mountain Host with a software engineering background. After the
              n-th time coordinating a ride via texting and emails and saying to myself "there should be an
              app for that!", I decided to create one that met my needs and (hopefully!) the needs of the
              MHSP community.
            </QA>
            <QA q="What if I want to help offset the hosting costs or recognize the development effort?">
              Sure!{' '}
              <a
                href="https://buymeacoffee.com/russellneville"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
              >
                Buy me a cup of coffee :)
              </a>
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
            <QA q="Can I favorite a driver?">
              Yes. On a ride's Driver Information card, use the "Favorite Driver" link to mark a driver you'd
              like to recognize quickly — favorited drivers show a star next to their name in ride listings.
              Manage your full list, including unfavoriting, from your profile page under Preferences.
            </QA>
            <QA q="How do I request a ride when no offered ride matches?">
              Use Request Ride to enter the pickup, destination, requested time, seat count, and equipment. A
              request starts without a network; a driver who can help selects a network and receives a
              prefilled offer form.
            </QA>
            <QA q="I've requested a ride. Is there a cutoff for a driver to fulfill it?">
              Yes, the ride request expires 6 hours before the requested ride. An hourly job processes expired
              requests, so the expiration email may arrive sometime during the following hour.
            </QA>
            <QA q="I've requested a ride. Can a driver change the ride details?">
              Yes, the driver can change the ride details, but you'll receive an email notification with the
              changes and you'll have an opportunity to cancel if the changed ride doesn't work for you.
            </QA>
            <QA q="What if a driver accepts my ride request with no changes?">
              You'll be automatically booked for the ride and receive an email notification.
            </QA>
            <QA q="I have equipment (skis, snowboard, bike). How do I know the driver can carry it?">
              For requested rides, the app checks the driver's vehicle for seats offered and listed equipment
              storage. If there's a mismatch, the driver is alerted and needs to confirm they can haul you
              and your gear.
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
              every booked rider gets a cancellation email that includes it.
            </QA>
            <QA q="Does anyone approve or manage my ride's status?">
              No. Whether a ride shows as Not Started, In Progress, or Completed is calculated automatically
              from its scheduled times — you don't need to mark it manually.
            </QA>
            <QA q="What vehicle information do riders see?">
              Whatever you've filled in on your profile — make, model, year, color, license plate, and seat
              count — so riders know what to look for.
            </QA>
            <QA q="How do multiple vehicles work?">
              Add vehicles on your Profile and choose a default. When offering or fulfilling a ride, select
              the vehicle you will use; the available-seat default follows that vehicle's capacity, and
              riders see the selected vehicle snapshot rather than every vehicle on your profile.
            </QA>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <QA q="Still have questions?">
              Use the Feedback widget (in the corner of any page) for quick tips, ideas, or comments. For
              account or booking issues, use the{' '}
              <Link href="/contact" className="text-foreground underline">
                Contact Us
              </Link>{' '}
              page instead.
            </QA>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Using MHSP Ride means agreeing to its Terms of Use, including that the site may only be used through
          the interfaces it provides — attempts to script, automate, or otherwise interfere with the site are
          grounds for account suspension.
        </p>

        <Button href="/dashboard">Continue to Dashboard</Button>
      </div>
    </DashboardLayout>
  )
}
