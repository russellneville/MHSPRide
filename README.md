![Mount Hood from Timberline](/public/assets/hood_2.jpg)

# MHSPRide

A private carpooling app for Mount Hood Ski Patrol members and Mountain Hosts. Timberline Lodge has limited parking, and getting there is half the battle — MHSPRide makes it easier to share the drive with people you already trust.

Built for the patrol, by the patrol.

---

## Who it's for

MHSP members and Mountain Hosts traveling to Timberline for patrol shifts and hosting duties. Access is restricted to verified MHSP members — registration requires your patrol ID number.

---

## What it does

- **Drivers** post rides with departure times, pickup locations, and gear capacity
- **Riders** search for rides, book seats, and coordinate pickup details
- **Three communities** — Hill Patrol, Mountain Hosts, and Nordic — each with their own ride pool
- **Pickup negotiation** — if a rider lives closer to the driver than the proposed pickup spot, the app surfaces that and lets them work out something better

![On the mountain at Timberline](/public/assets/hood_1.jpg)

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js + Tailwind CSS + Shadcn |
| Backend & DB | Firebase + Firestore |
| Auth | Firebase Authentication |
| Hosting | Google Cloud Platform |

---

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/russellneville/MHSPRide.git
cd MHSPRide
npm install
```

### 2. Configure Firebase

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Get these values from your Firebase project settings under **Project Settings > General > Your apps**.

### 3. Seed the database

Place a Firebase service account key at `scripts/serviceAccountKey.json` (see `scripts/README.md`), then run:

```bash
node scripts/seedNetworks.mjs
node scripts/seedMembers.mjs
```

### 4. Start the app

```bash
npm run dev
```

Open http://localhost:3000

---

## Roster sync

When the MHSP roster changes, run the sync process to update Firestore without disturbing existing registered accounts:

```bash
# 1. Geocode new addresses in the updated CSV
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
├── app/                    # Next.js pages
│   ├── dashboard/          # Protected dashboard (rides, bookings, networks, profile)
│   ├── login/              # Login page
│   └── register/           # Registration page
├── components/             # UI components
├── context/                # Auth and network state
├── lib/                    # Firebase config, locations, utilities
├── scripts/                # Seed and sync scripts (Node.js, Admin SDK)
├── resources/              # Roster CSVs, geocoding scripts, implementation docs
└── public/assets/          # Images and static files
```

---

## License

[MIT](LICENCE)
