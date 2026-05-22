# Architecture and Code Review

Reviewer: Codex
Date: 2026-05-22
Target: MHSPRide Next.js/Firebase project

## Scope

Reviewed the app architecture, Firestore rules, auth/register flow, ride/booking mutations, admin pages, API routes, and notification/email paths. This is a code-review draft for a Claude Code agent to triage and fix.

## Architecture Snapshot

MHSPRide is a client-heavy Next.js app backed by Firebase Auth, Firestore, Firebase Storage, and Resend. Most domain mutations happen directly from browser code in `context/AuthContext.jsx` and `context/NetworksContext.jsx`; API routes are used mainly for email and contact form handling. Firestore rules are therefore the primary security boundary.

## Findings

### Critical: Users can self-promote by writing their own role

`firestore.rules:15-18` allows any authenticated user to write their entire own `users/{uid}` document. `AuthContext.updateProfile()` writes arbitrary profile fields from the client at `context/AuthContext.jsx:125-130`, and `AdminGuard` trusts `user.role === 'admin'` at `components/AdminGuard.jsx:9-16`.

Failure path: a signed-in user can update their own user document to `{ role: "admin" }`. Current admin collection access is inconsistent, but this already unlocks client-side admin UI and any rules gated by `get(...users/uid).data.role == 'admin'` such as `feedback`, `activity_log`, and `config` in `firestore.rules:49-67`. If the admin rules suggested in `app/dashboard/admin/users/page.jsx:1-20` are applied, this becomes full Firestore admin escalation.

Fix: make `role`, `mhspNumber`, membership identity fields, and admin-only flags immutable to normal users in Firestore rules. Move role changes to a server/Admin SDK route or Firebase custom claims.

### Critical: Email notification routes are public spam and spoofing endpoints

`app/api/notify-booking/route.js:4-11`, `app/api/notify-cancellation/route.js:4-11`, `app/api/notify-registration/route.js:4-9`, and `app/api/notify-ride-update/route.js:4-39` accept unauthenticated JSON and send emails to caller-supplied recipients with caller-supplied content.

Failure path: anyone on the internet can POST arbitrary `passenger`, `driver`, `passengers`, `ride`, or `email` payloads and make `noreply@mhspride.com` send convincing MHSPRide messages. This can spam members, phish drivers/passengers, and burn Resend reputation/quota. `notify-ride-update` also interpolates unescaped user-controlled HTML at `app/api/notify-ride-update/route.js:19-33`.

Fix: require Firebase ID token auth, verify the caller is the actor for the referenced ride/booking, load recipients and ride data server-side from Firestore, rate-limit public contact, and HTML-escape all email fields or render through a safe template.

### Critical: Booking and ride update flows are broken by schema/rule mismatch

`firestore.rules:32-33` allows a ride update by `resource.data.driverId` or `request.auth.uid in resource.data.passengersIds`, but ride documents created in `context/NetworksContext.jsx:153-164` store `passengers: []` and never store `passengersIds`. Passenger booking then tries to update the ride at `context/NetworksContext.jsx:378-387`, so Firestore should reject the ride seat decrement/passenger append for non-drivers.

Related mismatch: booking documents created at `context/NetworksContext.jsx:347-376` store a nested `driver` object but no top-level `driverId`, while `firestore.rules:39-45` require `resource.data.driverId` for driver read/update access. Driver-side ride edits try to update passenger bookings at `context/NetworksContext.jsx:595-597`, but those updates should be denied because `driverId` is missing.

Fix: settle the canonical schema (`passengerIds`/`driverId` top-level fields), update creation code, migrations, and Firestore rules together. Add emulator tests for booking, driver viewing bookings, driver editing a booked ride, and cancellation propagation.

### High: Firestore rules trust client-side domain invariants too much

Rides can be created by any authenticated user with `driverId == uid` at `firestore.rules:31`, with no rule check that the user belongs to `network_id`, that dates/seats are sane, or that mutable fields are constrained. Network docs allow any authenticated update at `firestore.rules:20-25`, so a user can rewrite network membership arrays or metadata, not just join themselves through `context/NetworksContext.jsx:85-95`.

Failure path: a verified but unauthorized user can create rides in any network by crafting a client request, or corrupt network membership/metadata. Since most server-side validation is UI-only, bypassing React controls bypasses business rules.

Fix: encode membership and field-level constraints in Firestore rules, or move ride/network mutations to Admin SDK server actions/routes that validate membership, allowed fields, seat bounds, and status transitions.

### High: Member roster is publicly readable and claimable by any authenticated user

`firestore.rules:7-12` allows public reads of all `members` docs and lets any authenticated user update `claimed` and `claimedBy` on any member record. Registration reads `members/{mhspNumber}` and checks last name client-side at `context/AuthContext.jsx:38-54`, then separately creates a user and claims the member at `context/AuthContext.jsx:56-78`.

Failure path: roster names/classifications/coordinates are enumerable, authenticated users can pre-claim or unclaim arbitrary memberships, and the non-transactional registration flow can race between account creation and member claim.

Fix: hide member reads behind a server verification endpoint, only expose yes/no verification, perform create-user-and-claim as one trusted transaction/flow, and restrict claim updates to the service account.

### Medium: Multi-document writes are non-atomic and sometimes not awaited

Booking creates a booking, then updates the ride separately at `context/NetworksContext.jsx:347-387`. Cancellation/start/finalize use `forEach(async ...)` without awaiting passenger booking updates at `context/NetworksContext.jsx:653-659`, `context/NetworksContext.jsx:715-721`, and `context/NetworksContext.jsx:744-750`.

Failure path: partial writes leave bookings and rides inconsistent; cancellation can show success before booking updates finish or fail. Concurrent bookings can oversell seats because the seat decrement is based on stale `available_seats`.

Fix: use Firestore transactions or batched writes for seat reservations and status propagation. Await all async work with `Promise.all`, and enforce seat availability in the transaction.

### Medium: Admin implementation is split between comments, client UI, and rules

Admin pages read and write collections directly from the client, for example `getDocs(collection(db, 'users'))` at `app/dashboard/admin/users/page.jsx:98-103` and `getDocs(collection(db, 'rides'))` at `app/dashboard/admin/rides/page.jsx:89-94`. Current `firestore.rules:15-47` do not grant admins collection-wide access to users/rides/bookings, while the extra admin rules live only in a source comment at `app/dashboard/admin/users/page.jsx:1-20`.

Failure path: depending on which rule set is deployed, admin pages either fail in production or become vulnerable to self-promotion from the first finding.

Fix: define the real deployed rules in `firestore.rules`, add emulator coverage, and prefer server-side admin operations backed by custom claims rather than client-side role checks.

## Recommended Fix Order

1. Lock down `users/{uid}` writes so normal users cannot edit `role` or identity fields.
2. Require auth and server-side Firestore verification for all notification routes.
3. Align Firestore rules with the ride/booking schema and add emulator tests for core flows.
4. Move booking/cancel/update mutations to transactions or trusted server routes.
5. Replace public member roster reads/claims with a server verification and claim flow.
6. Consolidate admin authorization into deployed rules/custom claims, not source comments.

## Suggested Test Coverage

- Firestore emulator tests for normal user cannot self-promote.
- Normal passenger can book a valid ride exactly once and cannot oversell seats.
- Driver can see/update bookings for their own ride but not unrelated rides.
- Non-member cannot create a ride in a network.
- Public unauthenticated requests cannot trigger notification emails.
- Registration cannot claim an already-claimed member under concurrent attempts.
