/**
 * seedSimulatedShifts.mjs
 *
 * Seeds simulated Troopiter shifts plus carpool rides/ride-requests into
 * Firestore, for demoing and testing the shift-scoped carpool UI without
 * waiting on a real Troopiter launch. Driven by the /simulate-shifts skill,
 * which reads calendar screenshots and produces the --events-file this
 * script consumes — this script only owns the Firestore-writing half:
 * turning a list of {title, date, time, location} shift events into
 * shifts/rides/ride_requests/bookings docs with a randomized, believable
 * carpool mix (some shifts fully staffed, some short a rider, one or two
 * with nobody driving yet).
 *
 * Roster is drawn ONLY from synthetic @example.com members
 * (scripts/seedTroopiterDemoMembers.mjs on the 225-spike-shift-member-map-
 * picker-for-offering branch — the docs already exist in mhspride-test
 * regardless of which branch's code is checked out). Real patrol members
 * are never used as simulated drivers/riders.
 *
 * Every doc this script writes carries `simulated: true`. By default each
 * run clears all previously-simulated shifts/rides/ride_requests/bookings
 * first, so re-running (e.g. with a different calendar or count) replaces
 * rather than accumulates — pass --no-clear to disable that.
 *
 * Prerequisites:
 *   - .env.local: FIREBASE_SERVICE_ACCOUNT_KEY (must point at the
 *     mhspride-test project — this script refuses to run against anything
 *     else, same guard as scripts/seedTestData.mjs).
 *
 * Usage:
 *   node scripts/seedSimulatedShifts.mjs --events-file path/to/events.json
 *   node scripts/seedSimulatedShifts.mjs --events-file events.json --no-clear
 *   node scripts/seedSimulatedShifts.mjs --clear-only
 *
 * events.json shape:
 *   [
 *     { "title": "Bike Patrol - Timberline", "date": "2026-09-02", "time": "08:00", "location": "timberline" },
 *     { "title": "Skibowl Summer Ops",       "date": "2026-09-06", "time": "08:00", "location": "skibowl" },
 *     { "title": "Some New Place",           "date": "2026-09-08", "time": "09:00",
 *       "location": { "address": "123 Main St, Government Camp, OR 97028", "lat": 45.30, "lng": -121.75 } }
 *   ]
 *   `location` is either a key into the LOCATIONS table below, or an inline
 *   {address, lat, lng} object for a one-off place not worth adding there.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { assertTestProject } from './lib/assertTestProject.mjs'
import { readFileSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const ORG_ID = 'armadillo-mountain'
const NETWORK_ID = 'network-TROOPITER'

// Real, hand-verified coordinates for Armadillo Mountain's two patrol
// locations — same "no browser to geocode through" reasoning as
// mintTestLaunchToken.mjs's hardcoded Timberline Lodge point. Extend this
// table (or pass an inline {address,lat,lng} in events.json) if a future
// calendar names somewhere else.
const LOCATIONS = {
  timberline: { address: 'Timberline Lodge, Government Camp, OR 97028', lat: 45.3311281, lng: -121.7110064 },
  skibowl: { address: '87000 US-26, Government Camp, OR 97028', lat: 45.2939, lng: -121.7657 },
}

// Vehicles for the synthetic drivers who can offer a ride. Keyed by member
// email; deliberately excludes riley.chen@example.com, who
// seedTroopiterDemoMembers.mjs seeded with no address on file specifically
// to exercise the shift-member map picker's "no location" fallback (issue
// #225) — that member only ever appears here as a rider needing a ride.
const VEHICLES = {
  'alex.rivera@example.com': { make: 'Subaru', model: 'Outback', year: '2019', color: 'Green', plate: 'PTRL-01', seats: '4' },
  'casey.ortiz@example.com': { make: 'Honda', model: 'CR-V', year: '2021', color: 'Blue', plate: 'PTRL-02', seats: '4' },
  'jordan.kim@example.com': { make: 'Toyota', model: 'RAV4', year: '2018', color: 'White', plate: 'PTRL-03', seats: '4' },
  'morgan.brooks@example.com': { make: 'Ford', model: 'Escape', year: '2020', color: 'Black', plate: 'PTRL-04', seats: '4' },
  'sam.patel@example.com': { make: 'Subaru', model: 'Forester', year: '2017', color: 'Silver', plate: 'PTRL-05', seats: '4' },
  'taylor.nguyen@example.com': { make: 'Mazda', model: 'CX-5', year: '2022', color: 'Red', plate: 'PTRL-06', seats: '4' },
}

function parseArgs(argv) {
  const args = { clear: true }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--events-file') args.eventsFile = argv[++i]
    else if (argv[i] === '--no-clear') args.clear = false
    else if (argv[i] === '--clear-only') args.clearOnly = true
  }
  return args
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Deterministic per-member fake phone number, stable across runs.
function phoneFor(email) {
  let hash = 0
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return `503-555-${String(1000 + (hash % 9000)).slice(0, 4)}`
}

function photoUrlFor(fullname) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullname)}&background=126D41&color=fff&size=256`
}

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, Math.max(0, n))
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function resolveLocation(location) {
  if (typeof location === 'string') {
    const found = LOCATIONS[location]
    if (!found) throw new Error(`Unknown location key "${location}" — add it to LOCATIONS or pass {address,lat,lng} inline.`)
    return found
  }
  if (location && typeof location === 'object' && location.address) return location
  throw new Error(`Event location must be a LOCATIONS key or {address,lat,lng}, got: ${JSON.stringify(location)}`)
}

async function clearSimulated(db) {
  const collections = ['shifts', 'rides', 'ride_requests', 'bookings']
  let totalDeleted = 0
  for (const name of collections) {
    const snap = await db.collection(name).where('simulated', '==', true).get()
    if (snap.empty) continue
    const batch = db.batch()
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    totalDeleted += snap.size
    console.log(`  cleared ${snap.size} previously-simulated doc(s) from ${name}`)
  }
  return totalDeleted
}

async function loadRosterPool(db) {
  const snap = await db.collection('members').where('active', '==', true).get()
  return snap.docs
    .map(d => d.data())
    .filter(m => (m.email || '').toLowerCase().endsWith('@example.com'))
}

function memberEntry(m) {
  const fullname = `${m.firstName} ${m.lastName}`.trim()
  return {
    id: m.email,
    email: m.email,
    fullname,
    phone: phoneFor(m.email),
    photoURL: photoUrlFor(fullname),
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
    address: m.address || '',
  }
}

async function seedEvent(db, event, pool, index) {
  const location = resolveLocation(event.location)
  const shiftId = `SIM-${event.date.replace(/-/g, '')}-${slugify(event.title)}`
  const shiftDocId = `${ORG_ID}_${shiftId}`

  const rosterSize = randomInt(3, Math.min(5, pool.length))
  const roster = pickRandom(pool, rosterSize)
  const driversAvailable = roster.filter(m => m.latitude != null && VEHICLES[m.email])

  let driver = null
  if (driversAvailable.length && Math.random() < 0.85) {
    driver = pickRandom(driversAvailable, 1)[0]
  }

  const nonDriverRoster = roster.filter(m => m.email !== driver?.email)
  let passengers = []
  let seatsTotal = 0
  if (driver) {
    seatsTotal = randomInt(3, 4)
    const maxPassengers = Math.min(seatsTotal - 1, nonDriverRoster.length)
    passengers = pickRandom(nonDriverRoster, randomInt(0, maxPassengers))
  }

  const stillNeedsRide = nonDriverRoster.filter(m => !passengers.some(p => p.email === m.email))
  let requester = null
  if (stillNeedsRide.length && Math.random() < 0.55) {
    const noLocation = stillNeedsRide.filter(m => m.latitude == null)
    requester = (noLocation.length && Math.random() < 0.7)
      ? pickRandom(noLocation, 1)[0]
      : pickRandom(stillNeedsRide, 1)[0]
  }

  // Shift roster doc — mirrors app/api/launch/route.js's upsertShift shape.
  const dedupedRoster = roster.map(m => ({
    name: `${m.firstName} ${m.lastName}`.trim(),
    email: m.email,
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
  }))
  await db.collection('shifts').doc(shiftDocId).set({
    orgId: ORG_ID,
    shiftId,
    title: event.title,
    date: event.date,
    time: event.time,
    location,
    roster: dedupedRoster,
    rosterEmails: roster.map(m => m.email),
    updatedAt: FieldValue.serverTimestamp(),
    simulated: true,
  }, { merge: true })

  let rideId = null
  if (driver) {
    const driverEntry = memberEntry(driver)
    const vehicle = VEHICLES[driver.email]
    rideId = `ride-${shiftId}`

    const passengerEntries = passengers.map(p => {
      const entry = memberEntry(p)
      return {
        id: entry.id,
        email: entry.email,
        phone: entry.phone,
        fullname: entry.fullname,
        photoURL: entry.photoURL,
        booked_seats: 1,
        booked_at: new Date(),
        booking_id: `book-${shiftId}-${slugify(entry.fullname)}`,
        status: 'booked',
      }
    })

    await db.collection('rides').doc(rideId).set({
      departure: driverEntry.address || 'Government Camp, OR',
      arrival: location.address,
      departure_lat: driverEntry.latitude,
      departure_lng: driverEntry.longitude,
      arrival_lat: location.lat,
      arrival_lng: location.lng,
      custom_departure: true,
      custom_arrival: true,
      departure_date: event.date,
      arrival_date: event.date,
      departure_time: event.time,
      arrival_time: event.time,
      return_departure_time: '',
      one_way: true,
      ride_description: `Carpool to ${event.title}`,
      total_seats: seatsTotal,
      available_seats: seatsTotal - passengerEntries.length,
      driver: {
        id: driverEntry.id,
        email: driverEntry.email,
        fullname: driverEntry.fullname,
        phone: driverEntry.phone,
        photoURL: driverEntry.photoURL,
        vehicle_make: vehicle.make,
        vehicle_model: vehicle.model,
        vehicle_year: vehicle.year,
        vehicle_color: vehicle.color,
        vehicle_plate: vehicle.plate,
        vehicle_seats: vehicle.seats,
      },
      driverId: driverEntry.id,
      network_id: NETWORK_ID,
      passengers: passengerEntries,
      ride_status: 'not started',
      started_at: '',
      finished_at: '',
      created_at: FieldValue.serverTimestamp(),
      shift_id: shiftId,
      shift_name: event.title,
      simulated: true,
    })

    for (const p of passengerEntries) {
      const passengerMember = passengers.find(m => m.email === p.email)
      const passengerEntry = memberEntry(passengerMember)
      await db.collection('bookings').doc(p.booking_id).set({
        passenger: { id: passengerEntry.id, phone: passengerEntry.phone, email: passengerEntry.email, fullname: passengerEntry.fullname, photoURL: passengerEntry.photoURL },
        passengerId: passengerEntry.id,
        driver: {
          id: driverEntry.id, phone: driverEntry.phone, email: driverEntry.email, fullname: driverEntry.fullname,
          vehicle_make: vehicle.make, vehicle_model: vehicle.model, vehicle_year: vehicle.year,
          vehicle_color: vehicle.color, vehicle_plate: vehicle.plate, vehicle_seats: vehicle.seats,
        },
        driverId: driverEntry.id,
        ride_id: rideId,
        departure: driverEntry.address || 'Government Camp, OR',
        custom_departure: true,
        custom_arrival: true,
        departure_date: event.date,
        departure_time: event.time,
        arrival: location.address,
        arrival_date: event.date,
        arrival_time: event.time,
        return_departure_time: '',
        booking_status: 'booked',
        booked_seats: 1,
        networkId: NETWORK_ID,
        booked_at: new Date(),
        simulated: true,
      })
    }
  }

  let requestId = null
  if (requester) {
    const requesterEntry = memberEntry(requester)
    requestId = `req-${shiftId}`
    await db.collection('ride_requests').doc(requestId).set({
      departure: requesterEntry.address || '',
      arrival: location.address,
      departure_lat: requesterEntry.latitude,
      departure_lng: requesterEntry.longitude,
      arrival_lat: location.lat,
      arrival_lng: location.lng,
      custom_departure: true,
      custom_arrival: true,
      departure_date: event.date,
      departure_time: event.time,
      seats_requested: 1,
      equipment: '',
      notes: '',
      shift_id: shiftId,
      shift_name: event.title,
      requesterId: requesterEntry.id,
      requester: { id: requesterEntry.id, fullname: requesterEntry.fullname, email: requesterEntry.email, phone: requesterEntry.phone, photoURL: requesterEntry.photoURL },
      status: 'open',
      fulfilled_ride_id: null,
      created_at: FieldValue.serverTimestamp(),
      expires_at: new Date(new Date(`${event.date}T${event.time || '00:00'}`).getTime() - 6 * 60 * 60 * 1000),
      simulated: true,
    })
  }

  return {
    title: event.title,
    date: event.date,
    rosterSize: roster.length,
    driver: driver ? `${driver.firstName} ${driver.lastName}` : null,
    seats: driver ? `${seatsTotal - passengers.length}/${seatsTotal} open` : null,
    passengers: passengers.length,
    request: requester ? `${requester.firstName} ${requester.lastName}` : null,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local.')
    process.exit(1)
  }
  const serviceAccount = JSON.parse(raw)
  assertTestProject(serviceAccount)
  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  if (args.clearOnly) {
    console.log('Clearing all simulated data...')
    const n = await clearSimulated(db)
    console.log(`Done — cleared ${n} doc(s).`)
    return
  }

  if (!args.eventsFile) {
    console.error('❌  --events-file <path> is required (see file header for the expected JSON shape).')
    process.exit(1)
  }
  const events = JSON.parse(readFileSync(args.eventsFile, 'utf8'))
  if (!Array.isArray(events) || events.length === 0) {
    console.error('❌  Events file must contain a non-empty JSON array.')
    process.exit(1)
  }

  const pool = await loadRosterPool(db)
  if (pool.length < 3) {
    console.error(`❌  Only found ${pool.length} synthetic @example.com member(s) in members/ — need at least 3. Run scripts/seedTroopiterDemoMembers.mjs first.`)
    process.exit(1)
  }
  console.log(`Roster pool: ${pool.length} synthetic member(s).`)

  if (args.clear) {
    console.log('Clearing previously-simulated data...')
    await clearSimulated(db)
  }

  console.log(`Seeding ${events.length} simulated shift(s)...\n`)
  const rows = []
  for (let i = 0; i < events.length; i++) {
    rows.push(await seedEvent(db, events[i], pool, i))
  }

  console.log('Date        Shift                            Roster  Driver              Seats        Request')
  console.log('-'.repeat(100))
  for (const r of rows) {
    console.log(
      `${r.date}  ${r.title.padEnd(32).slice(0, 32)} ${String(r.rosterSize).padEnd(7)} ${(r.driver || '—').padEnd(19)} ${(r.seats || '—').padEnd(12)} ${r.request || '—'}`
    )
  }
  console.log(`\nDone — seeded ${rows.length} shift(s), ${rows.filter(r => r.driver).length} with a ride offered, ${rows.filter(r => r.request).length} with an open ride request.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
