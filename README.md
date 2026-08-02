![Mount Hood from Timberline](/public/assets/hood_2.jpg)

# MHSP Ride

A private carpooling app for Mount Hood Ski Patrol members and Mountain Hosts. Timberline Lodge has limited parking, and getting there is half the battle — MHSP Ride makes it easier to share the drive with people you already trust.

Built for the patrol, by the patrol.

---

[Screenshots](docs/screenshots.md)

## Who it's for

MHSP members and Mountain Hosts traveling to Timberline for patrol shifts and hosting duties. Access is restricted to verified MHSP members — registration requires your patrol ID number, last name, and Troopiter email, confirmed with an emailed one-time verification code.

---

## What it does

- **Offer rides** — post departure time, pickup location, return time, and notes. Drivers with more than one vehicle on file pick which one they're driving right from the dialog title ("Offer ride in: [vehicle]"); seat count defaults to that vehicle's capacity and updates automatically if they switch
- **Multiple vehicles** — add as many vehicles as needed from the profile page (make/model/year/color/plate/seats/equipment storage each), mark one as default. Profiles created before multi-vehicle support carry their single vehicle forward automatically the next time they're saved — no migration script needed
- **Book rides** — available rides are listed right on the dashboard, grouped by favorited network; reserve seats instantly, bookings close 6 hours before departure
- **Four communities** — Hill Patrol, Mountain Hosts, Nordic, and Mountain Biking each have their own ride pool. Users favorite networks (rather than "joining" them) to control which pools show on their dashboard; defaults come from their Troopiter roster classification, and favorites can be reordered or changed anytime from the dashboard
- **Smart arrival time** — auto-filled from a drive-time matrix covering every pickup/destination pair, computed automatically (via the Google Directions API) whenever an admin adds a new location
- **Ride management** — drivers can edit or cancel rides; canceling a ride cancels every booking tied to it and notifies each passenger by email
- **Cancellation with reason** — canceling a booking or a ride (rider or driver, self-service) always prompts for a free-text reason first, which is included in the cancellation email(s) and the activity log. Cancellation is never blocked outright — but if a rider cancels within 12 hours of departure, they're shown a one-button warning to call or text the driver directly before it goes through
- **Dashboard** — the single home screen: today's rides at a glance, scheduled rides (offered + booked), available rides per favorited network, and ride history — each list paginated 10/page with Previous/Next controls. Available Rides has date/origin/destination filters plus a driver/origin/destination search dialog, applied uniformly across every favorited network's list at once, with one-click clearing
- **FAQ** — a Riders/Drivers reference covering the site's actual business rules (booking cutoff, cancellation policy, how ride status and arrival times are calculated, etc.); shown right after the onboarding wizard completes, and always reachable from the sidebar afterward
- **Release notes** — a changelog page (`/dashboard/release-notes`, linked from the FAQ) listing feature highlights for each tagged version, newest first. Content lives in `lib/releaseNotes.js`; `npm run release-notes -- <tag> [prevTag]` drafts a new entry from git log commit subjects between two tags, which then gets trimmed down to user-facing features before committing
- **Terms and Privacy Policy** (issue #170) — public, unauthenticated pages at `/terms` and `/privacy`, reachable from the sidebar's Contact Us section and linked from the relevant FAQ answers. Content lives in `components/legal/TermsOfUseContent.jsx` and `PrivacyPolicyContent.jsx`; the registration flow's Terms of Use acceptance step reuses the same `TermsOfUseContent` component rather than duplicating the text
- **Email notifications** — registration verification codes and welcome email, booking receipts, ride change notices, and cancellations via Resend. Booking receipts, booking notices, and ride update emails each include "Add to Calendar" links (Google, Outlook web, and a `.ics` download for Apple Calendar/others) — see `lib/calendarLinks.js`
- **Favorite drivers** — mark a driver as a favorite from the "Favorite Driver"/"Unfavorite Driver" link on a ride's Driver Information card; favorited drivers show a star next to their name everywhere they appear in ride listings. Manage the full list — including unfavoriting — from the Profile page's "⭐️ Favorite Drivers" section under Preferences (hidden when the list is empty). Driver info (name, photo, vehicle) is snapshotted onto the favorite entry at the time you favorite them, the same way driver info is snapshotted onto rides/bookings, since Firestore rules don't allow reading another member's live profile
- **Favorite riders** (issue #162) — the reverse of favorite drivers: a driver can mark a rider as a favorite from the "Favorite Rider"/"Unfavorite Rider" link next to that rider in a ride's Passengers card (visible only to that ride's driver). Manage the full list from the Profile page's "⭐️ Favorite Riders" section under Preferences, same as Favorite Drivers. Rider info is snapshotted the same way driver info is
- **Achievement badges** (issue #143) — a catalog of milestone, activity, and whimsical badges (`lib/badges/catalog.js`) awarded automatically as members offer/book rides, favorite drivers/riders/networks, upload a photo, switch to dark mode, post or fulfill ride requests, and more. Simple actions award server-side the moment they happen; aggregate/time-based badges are evaluated lazily on dashboard load (throttled to once per 10 minutes). Newly-earned badges surface as a celebration dialog (confetti, one badge at a time with a Next arrow) the moment they're earned, and the full set is always visible on the Profile page's Badges card. Members who'd rather not participate can check "Hide badges and badge notifications" on Profile — badges keep being tracked silently in the background either way, so unchecking it later replays anything earned in the meantime as the same celebration dialog. The four favorite-rider badges (mirroring the existing favorite-driver ones) currently reuse driver-favorite artwork as placeholders — see issue #167 for custom art
- **Request a ride** (issue #158) — riders who can't find a matching ride can post a request instead (pickup, drop-off, time, seats, and equipment — skis/snowboard, bike, or none) with no network attached yet; it shows up in its own "Requested Rides" section on the dashboard, filterable the same way Available Rides is. Any driver can open a request, pick a network, and get a prefilled Offer Ride dialog; changing any of the request's details makes ride notes required (so the rider knows what changed), and the fulfillment email bolds exactly which fields differ from what was requested. Fulfilling a request auto-books the requesting rider for their seat count as one atomic transaction — never a partial state where the ride exists but the rider isn't on it. If the driver's vehicle has no matching storage option (ski box/bike rack) for the requested equipment, they get a one-time confirmation rather than being blocked outright. Unclaimed requests expire 6 hours before their requested time via an hourly GitHub Actions job rather than Vercel Cron, since this project's Vercel plan only supports daily-granularity cron. Admins see requests folded into the existing Rides table (a "Driver/Requestor" column, a "Requested" pill in place of network) with the same Edit/Cancel/Delete actions as any other ride
- **Admin panel** — user management, ride oversight, booking management, activity log, and leaderboard reports

---

## Current status

Phases 1–5, 7, and the admin panel are complete. The app is live at [mhspride.com](https://www.mhspride.com).

| Phase | Status |
|-------|--------|
| 1 — Seed & data foundation | Complete |
| 2 — Remove pricing | Complete |
| 3 — Member verification | Complete |
| 4 — Onboarding & UX | Complete |
| 5 — Predefined locations & drive times | Complete |
| Admin panel | Complete |
| 6 — Gear fields | Not started |
| 7 — Favorites | Complete |
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

# Google Maps — Geocoding API (admin roster/location address lookup) and
# Directions API (drive-time computation when an admin adds a location)
GOOGLE_MAPS_API_KEY=

# Firebase Admin SDK — full service account JSON, as a single-line string
# (Firebase Console → Project Settings → Service Accounts → Generate new private key)
FIREBASE_SERVICE_ACCOUNT_KEY=

# Shared secret for the hourly ride-request-expiry cron (GitHub Actions
# workflow at .github/workflows/expire-ride-requests.yml calls
# /api/cron/expire-ride-requests with this as a Bearer token). Generate with
# `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
# and set the same value here, in the Vercel project's env vars, and as the
# CRON_SECRET repo secret in GitHub Actions.
CRON_SECRET=

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

Users with `role: 'admin'` or `role: 'super-admin'` see an Admin section in the sidebar with access to:

- **Users** — view all registered users, suspend/unsuspend accounts (suspended users are force-logged-out, blocked from logging back in, and notified by email), reset passwords. Changing a user's role and resetting a claimed membership are **super-admin only** (see below) — a plain admin sees the role as read-only text and no Reset Membership button. Suspending an admin/super-admin also demotes them to `member` in the same action, but only when the actor is a super-admin; a plain admin can still suspend a fellow admin, it just won't touch their role. A plain admin can't suspend or reset the password of a **super-admin** at all — those buttons are hidden for that row, and `/api/admin/update-user` and `/api/reset-password` independently 403 the request server-side even if called directly. Clicking a row opens that user's profile (`app/dashboard/admin/users/[uid]`), which reuses the same personal-information/vehicles form as the self-service Profile page (`components/forms/ProfileForm.jsx`) so an admin can view and edit a member's name, phone, bio, and vehicles, plus a read-only Badges card showing everything that member has earned — always the real set, regardless of that member's own "Hide badges" preference. A plain admin can view but not edit another **admin or super-admin's** profile — the form renders disabled with an explanatory note, and `/api/admin/update-user-profile` independently 403s the request server-side even if called directly; only a super-admin can edit another admin/super-admin's profile
- **Rides** — view (sorted most recent first, paginated 25/page), search by driver/rider/route, filter by status/network/date range, click a row to see full details including the rider list (with a per-rider **Remove** action that cancels that booking, restores the seat, and emails the passenger), or edit/cancel/delete. Edit and Cancel are hidden once a ride is Completed or Canceled. The status shown (not started/in progress/Completed) is computed live from each ride's departure/arrival/return times, not from the stored `ride_status` field — that field only changes when a driver manually starts/finishes a ride, so a ride left untouched by its driver would otherwise show "not started" forever even after it's over. This page is also the only place admins manage bookings — there is no separate Bookings page; a booking's canonical status lives on its own `bookings` doc, not on the ride's embedded rider list, which is display-only
- **Roster** — browse the imported MHSP roster: search by name/MHSP#/email, filter by status or registration, click a member's coordinates to open them in Google Maps. The **Add** button opens a dialog to manually add a roster record (only Last Name, MHSP #, and Troopiter email are required — useful for test accounts that aren't in the Troopiter export). Clicking a row opens that member's record (`app/dashboard/admin/roster/[id]`) where an admin can edit name, email, address, status, and classifications; saves go through `/api/admin/update-roster-record` (Admin SDK), which re-geocodes lat/lon automatically when the address changes. If the member has claimed their account, a link jumps to their linked user profile on the Users page
- **Roster Import** *(super-admin only)* — upload a Troopiter CSV export, preview detected renames/new members/field updates/deactivations before anything is written, then commit (see [Roster import matching](#roster-import-matching) below). Each row in the Deactivated section has a checkbox — unchecking it keeps that member active instead of deactivating them, so a manually-added test account doesn't get wiped out just because it's not in the CSV. MHSP #s starting with `99` (the convention for manually-added test accounts) are unchecked by default
- **Locations** *(super-admin only)* — manage the pickup/arrival locations used throughout the app (Firestore-backed, replacing the old hardcoded list). Each location has a Role — Origin (pickup), Destination (mountain arrival), or Both (e.g. a site that's also a common pickup spot) — which controls which ride-offer dropdown(s) it appears in. Adding an Origin or Both location: type an address, confirm the geocoded pin (Google Geocoding API), then on save the app computes and stores drive times to every existing location it could pair with (Google Directions API) — this can take a few seconds. Destinations are entered as raw lat/lon. Editing is limited to name/lat-lon (doesn't recompute drive times). Deleting is blocked if any upcoming, non-canceled ride still uses that location; past rides that used a deleted location keep working but display a prettified fallback name instead
- **Activity Log** — paginated event log of all key system actions, filterable by type, date range, user, and message text; auto-refreshes in the background every 30 seconds. Each event type is color-coded by family (e.g. `booking.*` light purple, `feedback.*` green, `admin.*` orange) for quick visual scanning, and the message column wraps instead of truncating so long messages (like a cancellation reason) are fully readable
- **Feedback** — submissions from the in-app feedback widget (bottom-right corner of the dashboard on desktop, bottom-left on mobile to avoid covering page action buttons) and the [Contact](app/contact/page.jsx) form's Feedback/Bug/Support types, filterable by type and open/resolved status, with resolve/reopen actions. Every contact-form submission lands here regardless of type; a "Support" type submission additionally gets emailed (via Resend) to whatever address is set in Settings → support email (`app/api/contact/route.js`), so a real inbox can be alerted for urgent support requests instead of relying on someone checking this list. Each row shows a **Page** column with the path the submitter was on when they opened the widget (contact form submissions show `/contact`, since that's the only page that form is reachable from). **Respond** opens a dialog to email the submitter directly (via Resend), appends `RESPONSE: <reply>` to the entry's message, and marks it as responded. Deleting a feedback entry is **super-admin only**. The sidebar's "Feedback" nav item shows a live, bolded count of unresponded items (e.g. "Feedback **(3)**")
- **Reports** — stats cards (total users, rides, bookings), top drivers and top riders leaderboards, top 10 most favorited drivers, top 10 badge earners (one `collectionGroup` query across every member's `badges` subcollection, ranked by count), route popularity
- **Settings** *(super-admin only)* — site-wide config (support email the public contact form's "Support"-type submissions get emailed to, on top of always landing in Feedback — see above), stored on `config/site`; also manages the **System Message Banner** (issue #106) — schedule a message with a severity (info/warning/urgent), a start/end datetime window, and an optional "also show on login page" checkbox. Displayed at 12px at the top of the dashboard (every page, via `DashboardLayout`), and — when that checkbox is on — the login page and the public landing page (`/`) too, since both are reachable pre-auth. The admin table live-updates (Firestore `onSnapshot`, not a one-off fetch), so adds/edits/deletes made here — or from another tab or admin — show up immediately without a manual refresh. Backed by the `system_messages` collection (Admin SDK writes only, via `/api/admin/system-messages/*`; publicly readable since the login/landing pages need it pre-auth). Creating/editing a message is blocked if its window overlaps any other message's — every message always shows on the dashboard regardless of the login checkbox, so two overlapping windows would mean two banners competing for the same slot. `lib/systemMessages.js` holds the shared overlap/active-message logic used by both the API routes and the `SystemMessageBanner` component. Settings also has a **Maintenance Mode** toggle + optional system message (issue #108) — see below
- **Maintenance Mode** *(super-admin only, issue #108)* — a toggle + optional message on the Settings page, backed by the `config/maintenance` doc (Admin SDK writes only via `/api/admin/maintenance`, publicly readable since signed-out visitors need it too). When enabled: any signed-in standard member is force-logged-out (via `AuthContext`'s `maintenanceMode` listener, re-checked whenever the flag or the signed-in user changes — not just on the user's next Firestore write) and blocked from logging back in with a "MHSP Ride is in maintenance mode" message; admins and super-admins are unaffected and can still log in/stay logged in. Registration is blocked server-side at both `/api/register/verify-membership` (so no code email even goes out) and `/api/register/complete` (so no account can be created even with a stale, already-verified token). The landing page (`/`) swaps its normal hero for a maintenance notice — "Pardon the temporary disruption..." plus the optional system message and `public/assets/maintenance.png` — while keeping Contact Us and Log In reachable

### Super-admin role (issue #107)

`role: 'super-admin'` is a strict superset of `admin` — everywhere `isAdmin()`/`verifyAdminRequest` gates a feature, a super-admin passes too. On top of that, the following are gated to super-admin only, via `verifySuperAdminRequest`/`isSuperAdminUser` (`lib/adminAuth.js`), the `SuperAdminGuard` component, and matching `firestore.rules` checks:

- Locations page and its `/api/admin/locations/*` routes
- Roster Import page and its `/api/admin/roster-import*` routes
- Settings page and the `config/{id}` Firestore rule (`config/maintenance` is a more specific rule under the same collection — public read, Admin SDK write only, since the maintenance banner needs to show pre-auth)
- System Message Banner management and its `/api/admin/system-messages/*` routes (the `system_messages` Firestore rule itself allows public read — see below)
- Reset User Membership (`/api/admin/reset-membership`)
- Deleting feedback (`feedback/{id}` delete rule)
- Changing any user's role, including the auto-demote that happens when suspending an admin/super-admin (`/api/admin/update-user`) — a plain admin can still toggle `suspended` on its own
- Suspending or resetting the password of a super-admin (`/api/admin/update-user`, `/api/reset-password`) — a plain admin can still suspend/reset a fellow admin
- Editing another admin or super-admin's profile fields from the Users page (`/api/admin/update-user-profile`) — a plain admin can still edit a **member's** profile

### Setting up an admin user

Set `role: 'admin'` directly in **Firebase Console → Firestore → users → [uid]**. Once at least one super-admin exists, they can promote/demote roles from the Users page instead.

To migrate existing `director` role users to `admin`:

```bash
node scripts/migrateDirectorToAdmin.mjs
```

### Setting up the first super-admin

There's no in-app way to grant `super-admin` before one exists (it's the role that grants it). Bootstrap the first one by email:

```bash
node scripts/promoteSuperAdmin.mjs someone@example.com
```

### Firestore rules for admin access

The admin pages require updated Firestore security rules — see [`firestore.rules`](firestore.rules) for the canonical rule set (`isAdmin()`/`isSuperAdmin()`/`isSuspended()` helpers, and rules for `users`, `users/{uid}/badges`, `members`, `rides`, `networks`, `bookings`, `activity_log`, `locations`, `driveTimes`, `config`, `system_messages`, `rate_limits`, `registration_verifications`). `users/{uid}/badges` is owner-or-admin read, Admin-SDK-write-only; the Reports page's badge leaderboard additionally needs a second, admin-only rule written with the `{path=**}/badges/{badgeId}` recursive-wildcard form, since Firestore doesn't extend a subcollection-path rule to a `collectionGroup()` query on its own — every other collection here is read via its normal path, so this is the only one that needs it. `locations`/`driveTimes` are client-readable (any authenticated, non-suspended user — needed for the ride-offer dropdowns) but writable only through the Admin SDK–gated `/api/admin/locations/*` routes, which now require super-admin. `system_messages` goes further and allows read to anyone, signed in or not — the login page banner needs to read it pre-auth — but write is Admin SDK only, both for the super-admin check and because non-overlap validation needs a query across all existing messages that Firestore rules can't express. `config/maintenance` follows the same public-read/Admin-SDK-write pattern as `system_messages`, carved out as a rule specifically for that one document path — everything else under `config/{id}` stays super-admin-only. `firebase.json`/`.firebaserc` link this directory to the `mhspride` project, so `firebase deploy --only firestore:rules` deploys directly — no need to paste into the console. Check the deployed rules match this file before assuming a rules-dependent feature (like suspension enforcement) is actually enforced server-side — the two can drift if a change here isn't deployed (they did, silently, for several months, including the admin Users page's role-change/suspend actions, which the deployed `users` rule was actually rejecting the whole time; that write path now goes through `app/api/admin/update-user` — Admin SDK, `verifyAdminRequest`-gated — instead of a client Firestore write).

Non-owner updates to `rides` are scoped to only the fields booking actually needs (`available_seats`/`passengers`), not a blanket "any authenticated user can rewrite the whole document." `networks` docs are legacy membership records — the app now treats networks as fixed categories (`lib/networks.js`) with per-user favorites stored on `users/{uid}.favorite_networks`, so network docs are admin-write-only.

`members` is admin-read-only — registration no longer reads it from the client at all. The whole membership-verification/code/account-creation flow runs server-side through `app/api/register/verify-membership`, `verify-code`, and `complete` (Admin SDK), so there's no client path that can enumerate or read roster data pre-signup. If the matched roster record has an `address`, `verify-membership` returns it alongside the token and the Account Setup step (`components/forms/AccountSetupForm.jsx`) pre-fills an editable Home Address field with it. `complete` compares the submitted address against the roster's on file: unchanged, it reuses the roster's already-computed `latitude`/`longitude` directly (no extra API call); changed, it re-geocodes the new address via `lib/geocodeAddress.js` (same helper the admin roster-edit route uses) so the new user's coordinates actually match what they typed rather than carrying over stale roster coordinates for a different address.

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

## Password requirements

One standard (`lib/passwordPolicy.js`), enforced everywhere a password gets set: 10–128 characters, including at least one number or symbol. No forced upper/lowercase mix — length plus one non-letter character is a better security/usability tradeoff (NIST 800-63B) than traditional complexity rules. The upper bound exists purely to bound input size, not as a security requirement.

Applied at registration (`app/api/register/complete`), profile password changes (`app/api/account/update-password`), and self-service/admin-initiated password reset.

Password reset doesn't use Firebase's own reset-link system (`generatePasswordResetLink`/`oobCode`) at all — that always lands on Firebase's hosted reset page, and getting a custom action URL requires Firebase Hosting's domain-verification flow, which isn't available on this Vercel-hosted domain. Instead it follows the same pattern as registration verification: `app/api/reset-password` mints a random token, stores it on `password_resets/{token}` (Admin SDK only, 1-hour expiry, single use), and emails a link to our own branded `/reset-password` page (`components/forms/ResetPasswordForm.jsx`). Submitting the form hits `app/api/reset-password/confirm`, which validates the token and standard server-side and updates the password via the Admin SDK directly.

---

## Input length limits

Free-text inputs are capped both client-side (`maxLength`) and server-side, using shared constants rather than a magic number per field: `NAME_MAX_LENGTH`, `PHONE_MAX_LENGTH`, `MHSP_NUMBER_MAX_LENGTH`, `LOCATION_NAME_MAX_LENGTH`, `EMAIL_MAX_LENGTH` (`lib/utils.js`), `PASSWORD_MAX_LENGTH` (`lib/passwordPolicy.js`), and `VEHICLE_NAME_MAX_LENGTH`/`VEHICLE_PLATE_MAX_LENGTH` (`lib/vehicles.js`). Vehicle make/model additionally strip anything that isn't a letter, number, space, hyphen, or apostrophe via `sanitizeVehicleName()`, and vehicle year is a dropdown rather than free text, so there's nothing to cap.

Server-side, the caps are enforced in the relevant API routes (`register/complete`, `register/verify-membership`, `contact`) and — for the handful of fields written directly from the client via the Firestore SDK (profile fullname/phone, a ride's departure/arrival when set to a typed-in "other" location, feedback messages) — in `firestore.rules` itself, since there's no API layer in front of those writes. The `users` and `rides` rules only enforce a field's cap when that field is actually part of the write, so documents written before a cap existed aren't retroactively locked out of unrelated updates.

---

## Test data

A seed script generates a full set of synthetic test users, rides, and bookings for local development and QA. Seven pre-registered accounts cover admin access, network-scoped membership, pure riders, pure drivers, a cancellation history, and ride modification with booked passengers. Five unregistered member records support testing the registration flow.

See [`docs/test-data.md`](docs/test-data.md) for account credentials, test scenarios, and usage instructions.

```bash
node scripts/seedTestData.mjs      # load test data
node scripts/clearTestData.mjs     # remove test data
```

### One-time data cleanup

`scripts/fixStaleBookingStatuses.mjs` fixes bookings that were left at `booked`/`on progress` because their ride finished or was canceled without a matching driver action — a pre-existing data issue from before booking cancellation cascaded from ride-level actions. Supports `--dry-run`.

```bash
node scripts/fixStaleBookingStatuses.mjs --dry-run
node scripts/fixStaleBookingStatuses.mjs
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
│   ├── dashboard/              # Protected dashboard pages
│   │   ├── admin/              # Admin-only pages (users, rides, bookings, logs, feedback, reports, locations)
│   │   ├── network/[networkId]/ # Network ride list (with filters), ride detail
│   │   ├── profile/            # User profile (personal info, vehicle info, preferences)
│   │   ├── security/           # Email/password changes — split out from profile to reduce clutter
│   │   ├── onboarding/         # First-login wizard
│   │   ├── faq/                # Riders/Drivers FAQ — lands here right after onboarding
│   │   └── release-notes/      # Tagged-version changelog, linked from the FAQ page
│   ├── terms/                  # Public Terms and Conditions page
│   └── privacy/                # Public Privacy Policy page
├── components/
│   ├── popup-forms/            # OfferRidePopup, EditRidePopup, RideDetailsPopup
│   ├── CancelReasonDialog.jsx   # Shared reason + short-notice cancel flow (bookings & rides)
│   ├── forms/                  # Registration sub-forms
│   ├── legal/                  # Terms of Use / Privacy Policy content, shared by /terms, /privacy, and registration
│   ├── AdminGuard.jsx          # Redirects non-admins away from admin routes
│   ├── SuperAdminGuard.jsx     # Redirects non-super-admins away from super-admin-only routes
│   └── ui/                     # shadcn components + FeedbackWidget, CookieConsent
├── context/
│   ├── AuthContext.jsx         # Auth state, profile updates
│   ├── NetworksContext.jsx     # All Firestore ride/booking/network operations
│   └── LocationsContext.jsx    # Firestore-backed locations cache (origins/destinations, resolveLocation())
├── lib/
│   ├── networks.js             # Fixed network list + classification→default-favorite mapping
│   ├── drive-times.js          # Client-side drive-time lookups against the `driveTimes` collection
│   ├── serverLocations.js      # Admin SDK location-name lookups for code outside React (e.g. email.js)
│   ├── activityLog.js          # logEvent() utility — writes to activity_log collection
│   ├── rateLimit.js            # Fixed-window rate limiting — writes to rate_limits collection
│   ├── email.js                # Resend email helpers (registration, booking, cancellation)
│   ├── calendarLinks.js        # "Add to Calendar" event builder + Google/Outlook/.ics link generation
│   └── utils.js                # cn(), toLocalDateStr(), formatTime()
├── scripts/                    # Node.js seed/sync/admin scripts (Firebase Admin SDK)
├── docs/                       # Developer documentation (test data, etc.)
└── resources/                  # Roster CSVs, implementation docs (gitignored)
```

---

## License

[MIT](LICENCE)
