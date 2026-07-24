![Mount Hood from Timberline](/public/assets/hood_2.jpg)

# MHSPRide

A private carpooling app for Mount Hood Ski Patrol members and Mountain Hosts. Timberline Lodge has limited parking, and getting there is half the battle — MHSPRide makes it easier to share the drive with people you already trust.

Built for the patrol, by the patrol.

---

[Screenshots](docs/screenshots.md)

## Who it's for

MHSP members and Mountain Hosts traveling to Timberline for patrol shifts and hosting duties. Access is restricted to verified MHSP members — registration requires your patrol ID number, last name, and Troopiter email, confirmed with an emailed one-time verification code.

---

## What it does

- **Offer rides** — post departure time, pickup location, seat count, return time, and notes
- **Book rides** — browse upcoming rides in your network, reserve seats instantly
- **Three communities** — Hill Patrol, Mountain Hosts, and Nordic each have their own ride pool
- **Smart arrival time** — auto-filled from a pre-computed drive-time matrix for all pickup/destination pairs
- **Ride management** — drivers can edit or cancel rides; booked passengers are notified by email on changes
- **Passenger self-cancel** — passengers can cancel their own booking up to 12 hours before departure, freeing the seat and notifying the driver by email; after the cutoff they're directed to contact the driver directly
- **Dashboard** — see today's rides at a glance, upcoming rides, and a paginated ride history
- **Email notifications** — registration verification codes and welcome email, booking receipts, ride change notices, and cancellations via Resend
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

# Google Analytics (GA4 measurement ID) — only loads in production. Tracking
# is on by default (opt-out via the cookie consent banner); visitors who opt
# out are still counted via Google Consent Mode's cookieless modeled pings
NEXT_PUBLIC_GA_MEASUREMENT_ID=

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

- **Users** — view all registered users, change roles, reset claimed memberships, suspend/unsuspend accounts (suspended users are force-logged-out, blocked from logging back in, and notified by email)
- **Rides** — view, edit, cancel, or delete any ride across all networks
- **Bookings** — view and cancel any booking
- **Roster** — browse the imported MHSP roster: search by name/MHSP#/email, filter by status or registration, click a member's coordinates to open them in Google Maps
- **Roster Import** — upload a Troopiter CSV export, preview detected renames/new members/field updates/deactivations before anything is written, then commit (see [Roster import matching](#roster-import-matching) below)
- **Activity Log** — paginated event log of all key system actions, filterable by type, date range, user, and message text
- **Reports** — stats cards (total users, rides, bookings), top drivers and top riders leaderboards, route popularity

### Setting up an admin user

Set `role: 'admin'` directly in **Firebase Console → Firestore → users → [uid]**.

To migrate existing `director` role users to `admin`:

```bash
node scripts/migrateDirectorToAdmin.mjs
```

### Firestore rules for admin access

The admin pages require updated Firestore security rules — see [`firestore.rules`](firestore.rules) for the canonical rule set (`isAdmin()`/`isSuspended()` helpers, and rules for `users`, `members`, `rides`, `bookings`, `activity_log`, `rate_limits`, `registration_verifications`). `firebase.json`/`.firebaserc` link this directory to the `mhspride` project, so `firebase deploy --only firestore:rules` deploys directly — no need to paste into the console. Check the deployed rules match this file before assuming a rules-dependent feature (like suspension enforcement) is actually enforced server-side — the two can drift if a change here isn't deployed (they did, silently, for several months).

`members` is admin-read-only — registration no longer reads it from the client at all. The whole membership-verification/code/account-creation flow runs server-side through `app/api/register/verify-membership`, `verify-code`, and `complete` (Admin SDK), so there's no client path that can enumerate or read roster data pre-signup.

### Roster import matching

**MHSP# is not a stable identity.** Troopiter issues a brand-new MHSP# on a classification-driven promotion (e.g. Apprentice → full-status), not just on a genuine roster ID correction. The admin Roster Import flow (`lib/rosterDiff.js`) accounts for this: an incoming CSV row with an MHSP# that isn't in Firestore yet is matched against existing member docs by **last name + Troopiter email**, not by number. This search spans both the current import's newly-removed docs and every already-inactive doc in Firestore, so a promotion still gets linked correctly even if the old number disappeared in an earlier, separate import. A match is applied as an "ID change" (rename) — carrying over classifications/claimed-account state to the new doc and clearing them from the old one — rather than creating an orphaned duplicate. Rows with no email, or no matching candidate, fall through to a genuine new-member/deactivation as before. Members whose MHSP# doesn't change between imports are unaffected — same direct-match path as always.

Member docs that get superseded this way are kept (`active: false`, not deleted) for history, but are excluded from the Roster page under every filter — they'd otherwise still show their last real Status text and look like a live second person. `scripts/repairSupersededMemberClaims.mjs` is a one-time (dry-run by default) repair for docs orphaned before this fix shipped.

---

## Rate limiting

Unauthenticated endpoints that could otherwise be pummeled by a scripter are gated by `lib/rateLimit.js` — fixed-window counters (Admin SDK, `rate_limits` collection, never touched by client SDKs). Every threshold crossing logs a `security.rate_limit_exceeded` event to the Activity Log, once per window (not on every subsequent blocked attempt).

| Surface | Limit | Notes |
|---|---|---|
| Login failures, per email | 5 / 15 min | Login goes straight from the browser to Firebase Auth (never touches our server), so this is an app-layer gate — `app/api/login-guard` is asked before attempting sign-in and blocks in the UI if tripped, never calling Firebase. It does **not** stop someone scripting directly against Firebase's REST API; the recommended complementary defense is enabling Firebase Auth's reCAPTCHA-based abuse protection in the Firebase Console. |
| Login failures, per IP | 20 / hour | Coarser net for credential stuffing across many emails from one source. |
| Password reset, per email | 3 / hour | Self-service only — admin-initiated resets are already authenticated and logged separately. |
| Password reset, per IP | 10 / hour | |
| Registration attempts, per IP | 5 / hour | Shared across `app/api/register/verify-membership` and `app/api/register/complete` — every attempt counts, not just failures. |
| Registration attempts, per Troopiter email | 3 / hour | `app/api/register/verify-membership` — bounds how many verification-code emails one inbox can be sent. |
| Registration code checks, per IP | 20 / hour | `app/api/register/verify-code` — secondary guard on top of the 5-attempt-per-code cap below. |
| Contact form, per IP | 5 / hour | |
| `app/api/log-auth-event`, per IP | 30 / hour | This route is itself public (it logs failed logins, which by definition can happen with no authenticated session) — without its own limit, anyone could POST fake failures for a victim's email and trip their login cooldown. This bounds the blast radius rather than eliminating it. |

Registration is a two-secret flow on top of the table above: membership match (MHSP#/last name/Troopiter email) gets you a one-time 6-character code emailed to that address, capped at 5 incorrect guesses per code (tracked on the `registration_verifications` doc itself, not `rate_limits`) before it logs `security.registration_code_exceeded` and forces a restart.

`rate_limits` documents (`{key}__{windowIndex}`) carry an `expiresAt` field for an optional Firestore TTL policy (`gcloud firestore fields ttls update expiresAt --collection-group=rate_limits`) — without it the collection just grows slowly.

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

> **Prefer the admin panel's Roster Import page for anything involving a member's MHSP# changing.** This CLI path (`diffRoster.mjs`/`syncMembers.mjs`) does a raw ID-based diff with no rename detection at all — a classification-driven MHSP# reassignment looks like a plain delete+add here, which will orphan a duplicate member doc (see [Roster import matching](#roster-import-matching)). It's fine for updates where nobody's MHSP# changes.

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
│   ├── rateLimit.js            # Fixed-window rate limiting — writes to rate_limits collection
│   ├── email.js                # Resend email helpers (registration, booking, cancellation)
│   └── utils.js                # cn(), toLocalDateStr(), formatTime()
├── scripts/                    # Node.js seed/sync/admin scripts (Firebase Admin SDK)
├── docs/                       # Developer documentation (test data, etc.)
└── resources/                  # Roster CSVs, implementation docs (gitignored)
```

---

## License

[MIT](LICENCE)
