// Release notes shown on the /dashboard/release-notes page, newest first.
// Regenerate a draft entry for a new tag with scripts/generateReleaseNotes.mjs,
// then trim it down to user-facing features before committing.

export const RELEASE_NOTES = [
  {
    version: 'v0.9.5',
    date: '2026-07-30',
    highlights: [
      'Dashboard overhaul: favorites-based networks with a unified home screen and pagination',
      'Show profile avatars for ride drivers and passengers',
      'Add admin-managed ride locations',
      'Add filters and search to Available Rides on the Dashboard',
      'Default arrival location in the Offer Ride dialog based on network',
      'Enforce a password standard for new accounts',
      'Add a light/dark/system theme selector, including on the profile page',
      'Add bike rack as a vehicle option, plus .ics calendar export for rides',
      'Add a Discord server link to the FAQ and Contact Us pages',
      'Add a super-admin role',
      'Add a scheduled system message banner',
      'Add site maintenance mode',
      'Remove date-of-birth collection; require an 18+ confirmation at registration instead',
      'Declutter the profile page and restrict admin actions on super-admins',
      'Add "Add to Calendar" links to booking and ride-update emails',
      'Add multiple vehicles per driver, with a vehicle picker in the Offer Ride dialog',
      'Let admins view and edit user profiles from the Users page',
      'Let admins view and edit roster records from the Roster page',
      'Pre-populate the registration address field from the roster record',
      'Let riders favorite drivers, with a leaderboard on the admin Reports page',
      'Add an achievement badging system, with admin visibility and an opt-out toggle',
    ],
  },
  {
    version: 'v0.9.0',
    date: '2026-07-26',
    highlights: [
      'Offer and book rides across three networks (Hill Patrol, Mountain Hosts, Nordic)',
      'Member verification via patrol ID + Troopiter email with an emailed one-time code',
      'Smart arrival time calculated from a pre-computed drive-time matrix, recalculated on location change',
      'Ride/booking cancellation flow with a required reason, 6-hour booking cutoff, and a same-day warning for late rider cancellations',
      "Dashboard with today's rides, upcoming rides, and paginated history",
      'Riders/Drivers FAQ covering booking cutoff, cancellation policy, and status rules',
      'Email notifications (verification, welcome, booking receipts, ride changes, cancellations) via Resend',
      'Admin panel: user/roster management, ride and booking oversight, activity log, leaderboard reports',
      'Rate limiting on repeated auth attempts, scoped Firestore rules for rides/networks',
      'Google Analytics (GA4) gated by cookie consent',
    ],
  },
]
