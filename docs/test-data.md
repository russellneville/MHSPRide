# MHSPRide Test Data

Test data for the MHSPRide app. Covers the full member lifecycle: registered users with vehicles, a pure rider, an admin, canceled rides, and modified rides with booked passengers.

---

## Loading test data

Run the seed script with a service account key in place:

```bash
node scripts/seedTestData.mjs
```

The script is idempotent in the sense that it checks for an existing TEST1 member doc before writing. If test data is already loaded it exits with a message rather than duplicating records.

To preview what would be written without touching Firestore:

```bash
node scripts/seedTestData.mjs --dry-run
```

---

## Removing test data

```bash
node scripts/clearTestData.mjs
```

The clear script finds all Firestore `users` docs whose `fullname` contains `(test)` (case-insensitive), then deletes the associated rides, bookings, feedback, Auth accounts, and resets any claimed member records.

---

## Pre-registered test accounts

All accounts use password `test123test`.

| MHSP# | Name | Email | Role | Networks |
|-------|------|-------|------|----------|
| TEST1 | Blaze Whitmore (Test) | russellneville+TEST1@gmail.com | admin | Hill Patrol, Mountain Hosts, Nordic |
| TEST2 | Sierra Frost (Test) | russellneville+TEST2@gmail.com | member | Mountain Hosts |
| TEST3 | Jasper Ridgeline (Test) | russellneville+TEST3@gmail.com | member | Hill Patrol, Mountain Hosts, Nordic |
| TEST4 | Poppy Snowfield (Test) | russellneville+TEST4@gmail.com | member | Hill Patrol |
| TEST5 | Dale Shredmore (Test) | russellneville+TEST5@gmail.com | member | Hill Patrol, Nordic |
| TEST6 | Autumn Flakewell (Test) | russellneville+TEST6@gmail.com | member | Hill Patrol |
| TEST7 | Knox Bergmann (Test) | russellneville+TEST7@gmail.com | member | Hill Patrol, Mountain Hosts |

### Vehicles

| MHSP# | Year | Make | Model | Color | Plate | Seats |
|-------|------|------|-------|-------|-------|-------|
| TEST1 | 2019 | Subaru | Outback | Midnight Blue | TEST-BW1 | 4 |
| TEST2 | 2021 | Toyota | RAV4 | Pearl White | TEST-SF2 | 5 |
| TEST3 | 2018 | Audi | Q5 | Graphite | TEST-JR3 | 4 |
| TEST4 | — | — | — | — | — | — |
| TEST5 | 2020 | Ford | F-150 | Silver | TEST-DS5 | 5 |
| TEST6 | 2017 | Subaru | Forester | Forest Green | TEST-AF6 | 4 |
| TEST7 | 2022 | Jeep | Wrangler | Firebrick Red | TEST-KB7 | 3 |

---

## Unregistered member accounts

Use these MHSP numbers and last names to test the new-user registration flow. These records exist in the `members` collection but have no Firebase Auth account.

| MHSP# | First Name | Last Name | Approximate Location |
|-------|------------|-----------|----------------------|
| TEST8 | Finn | Avalanche | Sandy OR |
| TEST9 | Luna | Carvewell | Gresham OR |
| TEST10 | Beau | Poudreaux | Portland OR |
| TEST11 | Ember | Gully | Troutdale OR |
| TEST12 | Ridge | Chairworth | Portland OR |

---

## Test scenarios

### TEST1 — Admin (Blaze Whitmore)

The only admin account in the test data. Use this account to:

- Access the Admin panel (Users, Rides, Bookings, Activity Log, Reports)
- Change user roles
- Reset claimed memberships
- View and cancel any ride or booking
- Verify the Admin panel only appears for users with `role: 'admin'`

Also useful for verifying three-network access — Blaze is a member of all three networks.

---

### TEST2 — Mountain Hosts only (Sierra Frost)

A member of Mountain Hosts and no other network. Use this account to:

- Verify that network-scoped access works correctly — no Hill Patrol or Nordic rides appear
- Test the offer ride flow (Sierra has a vehicle)
- Confirm that joining only one network does not expose rides from other networks

---

### TEST3 — All networks (Jasper Ridgeline)

A member of Hill Patrol, Mountain Hosts, and Nordic. Use this account to:

- Verify cross-network behavior — rides from all three networks appear
- Test booking a ride as a passenger on a network they are also a driver in
- Confirm network switching in the dashboard

---

### TEST4 — No vehicle, pure rider (Poppy Snowfield)

Poppy has no vehicle fields in her user doc. Use this account to:

- Verify the offer ride flow is blocked or prompts for vehicle info
- Test the booking flow — Poppy appears frequently as a booked passenger in historical and future rides
- Check that the dashboard shows booked rides but no "My Offered Rides" data
- Confirm that no vehicle information appears on the profile page

---

### TEST5 — Pure driver (Dale Shredmore)

Dale offers rides consistently but rarely rides as a passenger. Use this account to:

- Test the offer ride form end-to-end
- Test editing a ride (times, seats, pickup location)
- Manage passengers — accept, decline, cancel
- View ride history from the driver perspective

---

### TEST6 — History of canceling rides (Autumn Flakewell)

Four past rides by TEST6 are seeded with `ride_status: 'canceled'`, spread across the last six weeks. Use this account to:

- Test the cancellation flow — offer a new ride and cancel it
- Verify that canceled rides appear correctly in ride history
- Check that passengers on canceled rides see the correct `booking_status`
- Verify that admin reports and the activity log capture cancellations

---

### TEST7 — Modifies rides with booked passengers (Knox Bergmann)

Two future rides by TEST7 have `ride_description` notes describing a pickup location change and a time change. TEST4 (Poppy) is booked on both rides. Use this account to:

- Test the edit ride flow when passengers are already booked
- Verify that booked passengers receive the update notification (check the test email inbox)
- Confirm that `ride_updated: true` and `update_seen: false` appear on the booking doc after an edit
- Test the passenger-side "dismiss update" flow logged in to TEST4

---

### TEST8–TEST12 — New user registration

These records exist in Firestore `members` but have no Auth account. Use them to test the registration flow:

1. Go to the registration page
2. Enter the MHSP number (e.g. TEST8) and last name (e.g. Avalanche)
3. The app should match the member record and proceed with account creation
4. After registration, the member doc should be marked `claimed: true` with the new uid in `claimedBy`

---

## Ride data overview

All ride dates are computed relative to the day the seed script runs, so the data stays current across test environments.

| Category | Volume | Status |
|----------|--------|--------|
| Past Saturdays (8 weeks) | 2 rides per day | completed |
| Past Sundays (8 weeks) | 1–2 rides per day | completed |
| Past weekdays (1 per week, 8 weeks) | 1 ride per day | completed |
| Autumn's canceled rides | 4 total, spread over last 6 weeks | canceled |
| Upcoming Saturdays (3 weeks) | 2–3 rides per day | open or full |
| Upcoming Sundays (3 weeks) | 1–2 rides per day | open |
| Next week's weekdays | 1 per day | open |
| Knox modification scenario | 2 future rides | open, with description notes |

Drivers rotate through TEST1, TEST3, TEST5, and TEST7 for Hill Patrol and Nordic rides. TEST2 appears as a driver on Mountain Hosts rides. TEST4 (Poppy) appears as a passenger on most rides.

---

## Notes for testers

**Email notifications** — the test emails use the `russellneville+TEST{N}@gmail.com` format, so all notifications go to the same real Gmail inbox and are distinguishable by the `+TEST{N}` suffix. Check that inbox after testing booking, cancellation, and ride update flows.

**Knox modification scenario** — the two Knox rides are seeded with the `ride_description` already showing the update note. To test the full flow, log in as TEST7, find one of those rides under My Offered Rides, and use the Edit Ride form to make a real change. The seeded description is there to show what passengers see when they land on the booking detail page after an update.

**Full rides** — some upcoming Saturday rides are seeded with `ride_status: 'full'` (zero available seats). Use these to verify that the Book Ride button is disabled or hidden, and that the ride appears correctly in the "full" state.

**Admin vs member view** — log in as TEST1 to see the Admin sidebar entries, then log in as any other test account to confirm those entries are not visible.

**Clearing** — after testing, `node scripts/clearTestData.mjs` removes all data tied to accounts whose `fullname` contains `(test)`. Real user data is never touched.
