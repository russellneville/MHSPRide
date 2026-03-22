![Mount Hood from Timberline](/public/assets/hood_2.jpg)

# MHSPRide

A private carpooling app for Mount Hood Ski Patrol members and Mountain Hosts. Timberline Lodge has limited parking, and getting there is half the battle — MHSPRide makes it easier to share the drive with people you already trust.

Built for the patrol, by the patrol.

---

[Screenshots](docs/screenshots.md)

## Who it's for

MHSP members and Mountain Hosts traveling to Timberline for patrol shifts and hosting duties. Access is restricted to verified MHSP members — registration requires your patrol ID number and last name.

---

## What it does

- **Offer rides** — post departure time, pickup location, seat count, return time, and notes
- **Book rides** — browse upcoming rides in your network, reserve seats instantly
- **Three communities** — Hill Patrol, Mountain Hosts, and Nordic each have their own ride pool
- **Smart arrival time** — auto-filled from a pre-computed drive-time matrix for all pickup/destination pairs
- **Ride management** — drivers can edit or cancel rides; booked passengers are notified by email on changes
- **Dashboard** — see today's rides at a glance, upcoming rides, and a paginated ride history
- **Email notifications** — registration welcome, booking receipts, ride change notices, and cancellations via Resend
- **Admin panel** — user management, ride oversight, booking management, activity log, and leaderboard reports

---

## Current status

Phases 1–5 and the admin panel are complete. The app is live at [mhspride.com](https://www.mhspride.com).

| Phase | Status |
|-------|--------|
| 1 — Seed & data foundation | Complete |
| 2 — Remove pricing | Complete |
| 3 — Member verification | Complete |
| 4 — Onboarding & UX | Complete |
| 5 — Predefined locations & drive times | Complete |
| Admin panel | Complete |
| 6 — Gear fields | Not started |
| 7 — Favorites | Not started |
| 8 — Pickup negotiation | Not started |

See `resources/implementation-plan.md` for full details.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 + Tailwind CSS v4 + shadcn/ui |
| Backend & DB | Firebase + Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage (profile photos) |
| Email | Resend |
| Hosting | Vercel |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/russellneville/MHSPRide.git
cd MHSPRide
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Firebase (Firebase Console → Project Settings → General → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Resend (resend.com) — transactional email
RESEND_API_KEY=

# Test data seed script (optional — see docs/test-data.md)
TEST_EMAIL_BASE=you@gmail.com
TEST_PASSWORD=yourpassword
```

### 3. Seed the database

Place a Firebase service account key at `scripts/serviceAccountKey.json`, then:

```bash
node scripts/seedNetworks.mjs
node scripts/seedMembers.mjs
```

### 4. Publish Firestore security rules

Copy the rules from `resources/implementation-plan.md` (Firestore Security Rules section) into **Firebase Console → Firestore → Rules** and publish.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Admin panel

Users with `role: 'admin'` see an Admin section in the sidebar with access to:

- **Users** — view all registered users, change roles, reset claimed memberships
- **Rides** — view, edit, cancel, or delete any ride across all networks
- **Bookings** — view and cancel any booking
- **Activity Log** — paginated event log of all key system actions, filterable by type, date range, user, and message text
- **Reports** — stats cards (total users, rides, bookings), top drivers and top riders leaderboards, route popularity

### Setting up an admin user

Set `role: 'admin'` directly in **Firebase Console → Firestore → users → [uid]**.

To migrate existing `director` role users to `admin`:

```bash
node scripts/migrateDirectorToAdmin.mjs
```

### Firestore rules for admin access

The admin pages require updated Firestore security rules. Add an `isAdmin()` helper and update rules for `users`, `members`, `rides`, `bookings`, and add rules for `activity_log`. See the comment block at the top of `app/dashboard/admin/users/page.jsx` for the full rule set to add in **Firebase Console → Firestore → Rules**.

---

## Test data

A seed script generates a full set of synthetic test users, rides, and bookings for local development and QA. Seven pre-registered accounts cover admin access, network-scoped membership, pure riders, pure drivers, a cancellation history, and ride modification with booked passengers. Five unregistered member records support testing the registration flow.

See [`docs/test-data.md`](docs/test-data.md) for account credentials, test scenarios, and usage instructions.

```bash
node scripts/seedTestData.mjs      # load test data
node scripts/clearTestData.mjs     # remove test data
```

---

## Roster sync

When the MHSP roster changes, update Firestore without disturbing existing accounts:

```bash
# 1. Geocode new addresses
cd resources && python3 geocode_roster.py

# 2. Diff against the previous version
node scripts/diffRoster.mjs --previous resources/mhsp-roster-geocoded-blank-free.csv --new resources/new-roster.csv

# 3. Apply changes to Firestore
node scripts/syncMembers.mjs --diff diff-output.json --csv resources/new-roster.csv
```

See `scripts/README.md` for full details.

---

## Project structure

```
MHSPRide/
├── app/
│   ├── api/                    # Server-side API routes (email, admin actions)
│   └── dashboard/              # Protected dashboard pages
│       ├── admin/              # Admin-only pages (users, rides, bookings, logs, reports)
│       ├── network/[networkId]/ # Network detail, ride list, ride detail, members
│       ├── rides/              # My Offered Rides
│       ├── bookings/           # My Booked Rides
│       ├── profile/            # User profile
│       └── onboarding/         # First-login wizard
├── components/
│   ├── popup-forms/            # OfferRidePopup, EditRidePopup, RideDetailsPopup
│   ├── forms/                  # Registration sub-forms
│   ├── AdminGuard.jsx          # Redirects non-admins away from admin routes
│   └── ui/                     # shadcn components + FeedbackWidget, CookieConsent
├── context/
│   ├── AuthContext.jsx         # Auth state, profile updates
│   └── NetworksContext.jsx     # All Firestore ride/booking/network operations
├── lib/
│   ├── locations.js            # Pickup locations + arrival destinations with coordinates
│   ├── drive-times.js          # Static drive-time matrix (minutes, no traffic)
│   ├── activityLog.js          # logEvent() utility — writes to activity_log collection
│   ├── email.js                # Resend email helpers (registration, booking, cancellation)
│   └── utils.js                # cn(), toLocalDateStr(), formatTime()
├── scripts/                    # Node.js seed/sync/admin scripts (Firebase Admin SDK)
├── docs/                       # Developer documentation (test data, etc.)
└── resources/                  # Roster CSVs, implementation docs (gitignored)
```

---

## License

[MIT](LICENCE)
