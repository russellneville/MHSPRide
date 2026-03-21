/**
 * seedTestData.mjs
 *
 * Seeds Firestore and Firebase Auth with synthetic test data for the MHSPRide app.
 * Creates 7 pre-registered users (TEST1–TEST7) with Auth accounts and Firestore user docs,
 * 5 unregistered member records (TEST8–TEST12), network memberships, and a full set of
 * historical and future rides with bookings.
 *
 * All test user fullnames end with " (Test)" — clearTestData.mjs uses this to scope deletion.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json (Firebase Admin service account)
 *   - npm install --save-dev firebase-admin
 *
 * Usage:
 *   node scripts/seedTestData.mjs
 *   node scripts/seedTestData.mjs --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { createRequire } from 'module'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Load .env.local from project root
config({ path: resolve(__dirname, '../.env.local') })

const EMAIL_BASE = process.env.TEST_EMAIL_BASE
const PASSWORD   = process.env.TEST_PASSWORD

if (!EMAIL_BASE) {
  console.error('❌  TEST_EMAIL_BASE is not set in .env.local')
  console.error('    Add: TEST_EMAIL_BASE=you@gmail.com')
  process.exit(1)
}
if (!PASSWORD) {
  console.error('❌  TEST_PASSWORD is not set in .env.local')
  console.error('    Add: TEST_PASSWORD=yourpassword')
  process.exit(1)
}

// Derive test email from base: you@gmail.com → you+TEST1@gmail.com
function testEmail(n) {
  const [local, domain] = EMAIL_BASE.split('@')
  return `${local}+TEST${n}@${domain}`
}

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

const DRY_RUN = process.argv.includes('--dry-run')

if (!DRY_RUN) {
  initializeApp({ credential: cert(serviceAccount) })
}

const db  = DRY_RUN ? null : getFirestore()
const auth = DRY_RUN ? null : getAuth()

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function pad(n) { return String(n).padStart(2, '0') }
function timeStr(h, m = 0) { return `${pad(h)}:${pad(m)}` }

function getSaturdays(weeksBack) {
  const dates = []
  const today = new Date()
  for (let w = 1; w <= weeksBack; w++) {
    const d = new Date(today)
    d.setDate(today.getDate() - (today.getDay() + 7 * w - 6)) // previous Saturday
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function getSundays(weeksBack) {
  const dates = []
  const today = new Date()
  for (let w = 1; w <= weeksBack; w++) {
    const d = new Date(today)
    d.setDate(today.getDate() - (today.getDay() + 7 * w - 7)) // previous Sunday
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

// One weekday per past week (Wednesday)
function getPastWeekdays(weeksBack) {
  const dates = []
  const today = new Date()
  for (let w = 1; w <= weeksBack; w++) {
    const d = new Date(today)
    d.setDate(today.getDate() - (today.getDay() + 7 * w - 3)) // previous Wednesday
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function getUpcomingSaturdays(weeksAhead) {
  const dates = []
  const today = new Date()
  const daysUntilSat = (6 - today.getDay() + 7) % 7 || 7
  for (let w = 0; w < weeksAhead; w++) {
    const d = new Date(today)
    d.setDate(today.getDate() + daysUntilSat + w * 7)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function getUpcomingSundays(weeksAhead) {
  const dates = []
  const today = new Date()
  const daysUntilSun = (7 - today.getDay()) % 7 || 7
  for (let w = 0; w < weeksAhead; w++) {
    const d = new Date(today)
    d.setDate(today.getDate() + daysUntilSun + w * 7)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

// Next week's weekdays (Mon–Fri)
function getNextWeekWeekdays() {
  const dates = []
  const today = new Date()
  const daysUntilMon = (8 - today.getDay()) % 7 || 7
  for (let d = 0; d < 5; d++) {
    const dt = new Date(today)
    dt.setDate(today.getDate() + daysUntilMon + d)
    dates.push(dt.toISOString().split('T')[0])
  }
  return dates
}

let rideIndex = 0
let bookIndex = 0

function nextRideId() {
  return `ride-TEST-${Date.now()}-${++rideIndex}`
}

function nextBookId() {
  return `book-TEST-${Date.now()}-${++bookIndex}`
}

// ── Static data ───────────────────────────────────────────────────────────────

const USERS = [
  {
    n: 1,
    mhspNumber: 'TEST1',
    fullname: 'Blaze Whitmore (Test)',
    email: testEmail(1),
    phone: '503-555-0101',
    birthdate: '1985-03-12',
    role: 'admin',
    networks: ['network-HILLPATROL', 'network-MOUNTAINHOSTS', 'network-NORDIC'],
    bio: 'Hill Patrol veteran with fifteen winters on the mountain. Runs the early-morning powder check before the lifts open and considers a strong cup of coffee a safety requirement.',
    vehicle_make: 'Subaru', vehicle_model: 'Outback', vehicle_year: '2019',
    vehicle_color: 'Midnight Blue', vehicle_plate: 'TEST-BW1', vehicle_seats: 4,
    photoURL: 'https://i.pravatar.cc/150?u=TEST1@mhspride.com',
  },
  {
    n: 2,
    mhspNumber: 'TEST2',
    fullname: 'Sierra Frost (Test)',
    email: testEmail(2),
    phone: '503-555-0102',
    birthdate: '1991-07-24',
    role: 'member',
    networks: ['network-MOUNTAINHOSTS'],
    bio: 'Mountain Host with encyclopedic knowledge of Timberline terrain. Asks every guest within range if they are having fun. The answer is usually yes.',
    vehicle_make: 'Toyota', vehicle_model: 'RAV4', vehicle_year: '2021',
    vehicle_color: 'Pearl White', vehicle_plate: 'TEST-SF2', vehicle_seats: 5,
    photoURL: 'https://i.pravatar.cc/150?u=TEST2@mhspride.com',
  },
  {
    n: 3,
    mhspNumber: 'TEST3',
    fullname: 'Jasper Ridgeline (Test)',
    email: testEmail(3),
    phone: '503-555-0103',
    birthdate: '1988-11-05',
    role: 'member',
    networks: ['network-HILLPATROL', 'network-MOUNTAINHOSTS', 'network-NORDIC'],
    bio: 'Ex-ski racer who crossed over to patrol. Still carries a race mindset on the hill, though somehow drives at a perfectly legal speed on Highway 26.',
    vehicle_make: 'Audi', vehicle_model: 'Q5', vehicle_year: '2018',
    vehicle_color: 'Graphite', vehicle_plate: 'TEST-JR3', vehicle_seats: 4,
    photoURL: 'https://i.pravatar.cc/150?u=TEST3@mhspride.com',
  },
  {
    n: 4,
    mhspNumber: 'TEST4',
    fullname: 'Poppy Snowfield (Test)',
    email: testEmail(4),
    phone: '503-555-0104',
    birthdate: '1995-02-18',
    role: 'member',
    networks: ['network-HILLPATROL'],
    bio: 'Nordic specialist who relies entirely on the carpool network to reach the mountain. Always shows up at the pickup spot early and brings homemade trail mix for anyone who wants it.',
    photoURL: 'https://i.pravatar.cc/150?u=TEST4@mhspride.com',
  },
  {
    n: 5,
    mhspNumber: 'TEST5',
    fullname: 'Dale Shredmore (Test)',
    email: testEmail(5),
    phone: '503-555-0105',
    birthdate: '1979-09-30',
    role: 'member',
    networks: ['network-HILLPATROL', 'network-NORDIC'],
    bio: 'Offers more rides than anyone else on the network and will tell you so. The car perpetually smells of ski wax and optimism.',
    vehicle_make: 'Ford', vehicle_model: 'F-150', vehicle_year: '2020',
    vehicle_color: 'Silver', vehicle_plate: 'TEST-DS5', vehicle_seats: 5,
    photoURL: 'https://i.pravatar.cc/150?u=TEST5@mhspride.com',
  },
  {
    n: 6,
    mhspNumber: 'TEST6',
    fullname: 'Autumn Flakewell (Test)',
    email: testEmail(6),
    phone: '503-555-0106',
    birthdate: '1993-06-14',
    role: 'member',
    networks: ['network-HILLPATROL'],
    bio: 'Books every shift weeks in advance. Life has other plans roughly once a month. Always apologetic, always means it.',
    vehicle_make: 'Subaru', vehicle_model: 'Forester', vehicle_year: '2017',
    vehicle_color: 'Forest Green', vehicle_plate: 'TEST-AF6', vehicle_seats: 4,
    photoURL: 'https://i.pravatar.cc/150?u=TEST6@mhspride.com',
  },
  {
    n: 7,
    mhspNumber: 'TEST7',
    fullname: 'Knox Bergmann (Test)',
    email: testEmail(7),
    phone: '503-555-0107',
    birthdate: '1987-04-22',
    role: 'member',
    networks: ['network-HILLPATROL', 'network-MOUNTAINHOSTS'],
    bio: 'Shows up with a detailed plan, adjusts the plan twice on the way to the mountain, and still arrives on time. Passengers have learned to read the texts.',
    vehicle_make: 'Jeep', vehicle_model: 'Wrangler', vehicle_year: '2022',
    vehicle_color: 'Firebrick Red', vehicle_plate: 'TEST-KB7', vehicle_seats: 3,
    photoURL: 'https://i.pravatar.cc/150?u=TEST7@mhspride.com',
  },
]

const UNREGISTERED_MEMBERS = [
  {
    mhspNumber: 'TEST8',
    firstName: 'Finn',
    lastName: 'Avalanche',
    latitude: 45.3973,
    longitude: -122.2635,
  },
  {
    mhspNumber: 'TEST9',
    firstName: 'Luna',
    lastName: 'Carvewell',
    latitude: 45.5024,
    longitude: -122.4305,
  },
  {
    mhspNumber: 'TEST10',
    firstName: 'Beau',
    lastName: 'Poudreaux',
    latitude: 45.5231,
    longitude: -122.6765,
  },
  {
    mhspNumber: 'TEST11',
    firstName: 'Ember',
    lastName: 'Gully',
    latitude: 45.5393,
    longitude: -122.3878,
  },
  {
    mhspNumber: 'TEST12',
    firstName: 'Ridge',
    lastName: 'Chairworth',
    latitude: 45.5051,
    longitude: -122.6750,
  },
]

// Departure and arrival pool — must match lib/locations.js IDs
const HP_DEPARTURES = ['powell-butte', 'sandy-fred-meyer', 'troutdale-fred-meyer', 'gresham-transit']
const ARRIVALS_HP = ['timberline', 'buzz-bowman']
const ARRIVALS_NORDIC = ['timberline', 'buzz-bowman', 'meadows']
const MH_DEPARTURES = ['gresham-transit', 'clackamas-tc', 'troutdale-fred-meyer']

// Rotate helpers
function rotate(arr, i) { return arr[i % arr.length] }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== MHSPRide test data seed${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)

  // Guard: check if TEST1 member doc already exists
  if (!DRY_RUN) {
    const existing = await db.collection('members').doc('TEST1').get()
    if (existing.exists) {
      console.log('Test data already loaded. Run clearTestData.mjs first.')
      process.exit(0)
    }
  }

  // ── Step 1: Unregistered member records ──────────────────────────────────────
  console.log('1. Creating unregistered member records (TEST8–TEST12)...')
  for (const m of UNREGISTERED_MEMBERS) {
    const doc = {
      mhspNumber: m.mhspNumber,
      firstName: m.firstName,
      lastName: m.lastName,
      classifications: [],
      latitude: m.latitude,
      longitude: m.longitude,
      claimed: false,
      claimedBy: null,
    }
    if (DRY_RUN) {
      console.log(`  [dry] members/${m.mhspNumber}: ${m.firstName} ${m.lastName}`)
    } else {
      await db.collection('members').doc(m.mhspNumber).set(doc)
      console.log(`  members/${m.mhspNumber}: ${m.firstName} ${m.lastName}`)
    }
  }

  // ── Step 2: Create Firebase Auth + Firestore user docs (TEST1–TEST7) ─────────
  console.log('\n2. Creating Auth accounts and user docs (TEST1–TEST7)...')

  const uidMap = {} // mhspNumber → uid

  for (const u of USERS) {
    let uid

    if (DRY_RUN) {
      uid = `uid-TEST${u.n}-placeholder`
      console.log(`  [dry] Auth + users/${uid}: ${u.fullname} (${u.email})`)
    } else {
      // Create or reuse Auth account
      try {
        const record = await auth.createUser({
          email: u.email,
          password: PASSWORD,
          displayName: u.fullname,
        })
        uid = record.uid
      } catch (err) {
        if (err.code === 'auth/email-already-exists') {
          const record = await auth.getUserByEmail(u.email)
          uid = record.uid
          console.log(`  Auth: ${u.email} already exists, reusing uid ${uid}`)
        } else {
          throw err
        }
      }

      const userDoc = {
        email: u.email,
        fullname: u.fullname,
        phone: u.phone,
        birthdate: u.birthdate,
        bio: u.bio,
        role: u.role,
        mhspNumber: u.mhspNumber,
        classifications: [],
        latitude: null,
        longitude: null,
        created_at: Timestamp.now(),
        onboarding_complete: true,
        photoURL: u.photoURL,
      }

      // Vehicle fields for drivers
      if (u.vehicle_make) {
        Object.assign(userDoc, {
          vehicle_make: u.vehicle_make,
          vehicle_model: u.vehicle_model,
          vehicle_year: u.vehicle_year,
          vehicle_color: u.vehicle_color,
          vehicle_plate: u.vehicle_plate,
          vehicle_seats: u.vehicle_seats,
          equipment_storage: false,
        })
      }

      await db.collection('users').doc(uid).set(userDoc)

      // Also create a claimed member doc for TEST1–TEST7 so registration flow is satisfied
      await db.collection('members').doc(u.mhspNumber).set({
        mhspNumber: u.mhspNumber,
        firstName: u.fullname.split(' ')[0],
        lastName: u.fullname.split(' ')[1],
        classifications: [],
        latitude: null,
        longitude: null,
        claimed: true,
        claimedBy: uid,
      })

      console.log(`  users/${uid}: ${u.fullname}`)
    }

    uidMap[u.mhspNumber] = uid
  }

  // ── Step 3: Add test users to networks ────────────────────────────────────────
  console.log('\n3. Adding test users to networks...')

  // Map networkId → list of user mhspNumbers
  const networkMemberships = {
    'network-HILLPATROL': ['TEST1', 'TEST3', 'TEST4', 'TEST5', 'TEST6', 'TEST7'],
    'network-MOUNTAINHOSTS': ['TEST1', 'TEST2', 'TEST3', 'TEST7'],
    'network-NORDIC': ['TEST1', 'TEST3', 'TEST5'],
  }

  for (const [networkId, mhspNums] of Object.entries(networkMemberships)) {
    if (DRY_RUN) {
      console.log(`  [dry] ${networkId}: add ${mhspNums.join(', ')}`)
      continue
    }

    const networkRef = db.collection('networks').doc(networkId)
    const snap = await networkRef.get()
    if (!snap.exists) {
      console.log(`  WARNING: ${networkId} not found — run seedNetworks.mjs first`)
      continue
    }

    const networkData = snap.data()
    const existingIds = new Set(networkData.passengersIds || [])

    for (const mhspNumber of mhspNums) {
      const uid = uidMap[mhspNumber]
      if (!uid || existingIds.has(uid)) continue

      const user = USERS.find(u => u.mhspNumber === mhspNumber)

      await networkRef.update({
        passengersIds: FieldValue.arrayUnion(uid),
        passengers: FieldValue.arrayUnion({
          id: uid,
          fullname: user.fullname,
          email: user.email,
          phone: user.phone,
          role: 'member',
        }),
      })
    }

    console.log(`  ${networkId}: added ${mhspNums.length} test members`)
  }

  // Helper to build a driver object from user + uid
  function driverObj(mhspNumber) {
    const u = USERS.find(x => x.mhspNumber === mhspNumber)
    const uid = uidMap[mhspNumber]
    return {
      id: uid,
      email: u.email,
      fullname: u.fullname,
      phone: u.phone,
      vehicle_make: u.vehicle_make || '',
      vehicle_model: u.vehicle_model || '',
      vehicle_year: u.vehicle_year || '',
      vehicle_color: u.vehicle_color || '',
      vehicle_plate: u.vehicle_plate || '',
      vehicle_seats: u.vehicle_seats || '',
      photoURL: u.photoURL,
    }
  }

  function passengerObj(mhspNumber) {
    const u = USERS.find(x => x.mhspNumber === mhspNumber)
    const uid = uidMap[mhspNumber]
    return {
      id: uid,
      email: u.email,
      fullname: u.fullname,
      phone: u.phone,
    }
  }

  // Build a completed ride with bookings
  function buildRide(opts) {
    const {
      date, driverMhsp, departure, arrival, network,
      departureTime, arrivalTime, returnTime,
      totalSeats, passengerMhspNums = [],
      status = 'completed', description = '',
    } = opts

    const rideId = nextRideId()
    const driver = driverObj(driverMhsp)
    const availableSeats = Math.max(0, totalSeats - passengerMhspNums.length)

    const passengerEntries = passengerMhspNums.map(pMhsp => {
      const bookId = nextBookId()
      const p = passengerObj(pMhsp)
      return {
        entry: {
          id: p.id,
          email: p.email,
          phone: p.phone,
          fullname: p.fullname,
          booked_seats: 1,
          booked_at: Timestamp.now(),
          booking_id: bookId,
          status: status === 'completed' ? 'completed' : 'booked',
        },
        booking: {
          id: bookId,
          passengerId: p.id,
          passenger: { id: p.id, phone: p.phone, email: p.email, fullname: p.fullname },
          driverId: driver.id,
          driver: {
            id: driver.id, phone: driver.phone, email: driver.email,
            fullname: driver.fullname,
            vehicle_make: driver.vehicle_make,
            vehicle_model: driver.vehicle_model,
            vehicle_year: driver.vehicle_year,
            vehicle_color: driver.vehicle_color,
            vehicle_plate: driver.vehicle_plate,
            vehicle_seats: driver.vehicle_seats,
          },
          rideId,
          network_id: network,
          departure,
          arrival,
          departure_date: date,
          departure_time: departureTime,
          arrival_time: arrivalTime,
          return_departure_time: returnTime,
          seats_booked: 1,
          booking_status: status === 'completed' ? 'completed' : 'booked',
        },
      }
    })

    const rideDoc = {
      departure,
      arrival,
      departure_date: date,
      departure_time: departureTime,
      arrival_date: date,
      arrival_time: arrivalTime,
      return_departure_time: returnTime,
      one_way: false,
      total_seats: totalSeats,
      available_seats: availableSeats,
      ride_status: status,
      ride_description: description,
      driverId: driver.id,
      driver: { ...driver },
      network_id: network,
      passengers: passengerEntries.map(x => x.entry),
      started_at: '',
      finished_at: '',
    }

    return { rideId, rideDoc, bookings: passengerEntries.map(x => ({ id: x.booking.id, doc: x.booking })) }
  }

  // ── Step 4: Historical rides ──────────────────────────────────────────────────
  console.log('\n4. Generating historical rides and bookings...')

  const pastRides = []

  const pastSaturdays = getSaturdays(8)
  const pastSundays   = getSundays(8)
  const pastWeekdays  = getPastWeekdays(8)

  const weekendDrivers = ['TEST1', 'TEST3', 'TEST5', 'TEST7']
  const weekendDeps    = HP_DEPARTURES

  // Saturdays — 2 rides each
  pastSaturdays.forEach((date, i) => {
    const d1 = weekendDrivers[(i * 2) % weekendDrivers.length]
    const d2 = weekendDrivers[(i * 2 + 1) % weekendDrivers.length]

    pastRides.push(buildRide({
      date,
      driverMhsp: d1,
      departure: rotate(weekendDeps, i),
      arrival: rotate(ARRIVALS_HP, i),
      network: 'network-HILLPATROL',
      departureTime: timeStr(7, 0),
      arrivalTime: timeStr(8, 30),
      returnTime: timeStr(16, 0),
      totalSeats: 4,
      passengerMhspNums: ['TEST4', 'TEST3'].filter(p => p !== d1).slice(0, 2),
      status: 'completed',
    }))

    pastRides.push(buildRide({
      date,
      driverMhsp: d2,
      departure: rotate(weekendDeps, i + 2),
      arrival: rotate(ARRIVALS_HP, i + 1),
      network: 'network-HILLPATROL',
      departureTime: timeStr(6, 30),
      arrivalTime: timeStr(8, 0),
      returnTime: timeStr(15, 30),
      totalSeats: 3,
      passengerMhspNums: ['TEST4'].filter(p => p !== d2),
      status: 'completed',
    }))
  })

  // Sundays — 2 rides each
  pastSundays.forEach((date, i) => {
    const d1 = weekendDrivers[(i + 1) % weekendDrivers.length]
    const d2 = weekendDrivers[(i + 2) % weekendDrivers.length]

    pastRides.push(buildRide({
      date,
      driverMhsp: d1,
      departure: rotate(weekendDeps, i + 1),
      arrival: rotate(ARRIVALS_HP, i),
      network: 'network-HILLPATROL',
      departureTime: timeStr(7, 30),
      arrivalTime: timeStr(9, 0),
      returnTime: timeStr(16, 30),
      totalSeats: 4,
      passengerMhspNums: ['TEST3', 'TEST4'].filter(p => p !== d1).slice(0, 2),
      status: 'completed',
    }))

    // Every other Sunday: Nordic ride
    if (i % 2 === 0) {
      pastRides.push(buildRide({
        date,
        driverMhsp: 'TEST5',
        departure: 'sandy-fred-meyer',
        arrival: rotate(ARRIVALS_NORDIC, i),
        network: 'network-NORDIC',
        departureTime: timeStr(7, 0),
        arrivalTime: timeStr(8, 30),
        returnTime: timeStr(15, 0),
        totalSeats: 5,
        passengerMhspNums: ['TEST3'],
        status: 'completed',
      }))
    }
  })

  // Past weekdays — 1 ride each
  pastWeekdays.forEach((date, i) => {
    const driver = weekendDrivers[i % weekendDrivers.length]
    pastRides.push(buildRide({
      date,
      driverMhsp: driver,
      departure: rotate(weekendDeps, i),
      arrival: rotate(ARRIVALS_HP, i),
      network: 'network-HILLPATROL',
      departureTime: timeStr(6, 45),
      arrivalTime: timeStr(8, 15),
      returnTime: timeStr(15, 45),
      totalSeats: 4,
      passengerMhspNums: ['TEST4'].filter(p => p !== driver),
      status: 'completed',
    }))
  })

  // ── Step 5: Autumn's canceled rides (TEST6) ───────────────────────────────────
  const cancelDates = [
    daysFromNow(-42),
    daysFromNow(-35),
    daysFromNow(-21),
    daysFromNow(-14),
  ]
  cancelDates.forEach((date, i) => {
    pastRides.push(buildRide({
      date,
      driverMhsp: 'TEST6',
      departure: rotate(weekendDeps, i),
      arrival: 'buzz-bowman',
      network: 'network-HILLPATROL',
      departureTime: timeStr(7, 0),
      arrivalTime: timeStr(8, 30),
      returnTime: timeStr(16, 0),
      totalSeats: 4,
      passengerMhspNums: [],
      status: 'canceled',
    }))
  })

  console.log(`  Generated ${pastRides.length} historical ride objects`)

  // ── Step 6: Future rides ──────────────────────────────────────────────────────
  console.log('\n5. Generating future rides and bookings...')

  const futureRides = []
  const upcomingSaturdays = getUpcomingSaturdays(3)
  const upcomingSundays   = getUpcomingSundays(3)
  const nextWeekdays      = getNextWeekWeekdays()

  // Saturdays — 2–3 rides
  upcomingSaturdays.forEach((date, i) => {
    const d1 = weekendDrivers[i % weekendDrivers.length]
    const d2 = weekendDrivers[(i + 1) % weekendDrivers.length]

    futureRides.push(buildRide({
      date,
      driverMhsp: d1,
      departure: rotate(weekendDeps, i),
      arrival: rotate(ARRIVALS_HP, i),
      network: 'network-HILLPATROL',
      departureTime: timeStr(7, 0),
      arrivalTime: timeStr(8, 30),
      returnTime: timeStr(16, 0),
      totalSeats: 4,
      passengerMhspNums: ['TEST4'],
      status: 'open',
    }))

    futureRides.push(buildRide({
      date,
      driverMhsp: d2,
      departure: rotate(weekendDeps, i + 1),
      arrival: rotate(ARRIVALS_HP, i + 1),
      network: 'network-HILLPATROL',
      departureTime: timeStr(6, 30),
      arrivalTime: timeStr(8, 0),
      returnTime: timeStr(15, 30),
      totalSeats: 3,
      passengerMhspNums: ['TEST4', 'TEST3'].filter(p => p !== d2).slice(0, 3),
      status: 'full',
    }))

    // Mountain Hosts ride on first Saturday
    if (i === 0) {
      futureRides.push(buildRide({
        date,
        driverMhsp: 'TEST2',
        departure: rotate(MH_DEPARTURES, i),
        arrival: 'timberline',
        network: 'network-MOUNTAINHOSTS',
        departureTime: timeStr(8, 0),
        arrivalTime: timeStr(9, 30),
        returnTime: timeStr(17, 0),
        totalSeats: 5,
        passengerMhspNums: ['TEST3'],
        status: 'open',
      }))
    }
  })

  // Sundays — 2 rides each
  upcomingSundays.forEach((date, i) => {
    const d1 = weekendDrivers[(i + 2) % weekendDrivers.length]

    futureRides.push(buildRide({
      date,
      driverMhsp: d1,
      departure: rotate(weekendDeps, i + 2),
      arrival: rotate(ARRIVALS_HP, i),
      network: 'network-HILLPATROL',
      departureTime: timeStr(7, 30),
      arrivalTime: timeStr(9, 0),
      returnTime: timeStr(16, 30),
      totalSeats: 4,
      passengerMhspNums: ['TEST4'],
      status: 'open',
    }))

    if (i % 2 === 0) {
      futureRides.push(buildRide({
        date,
        driverMhsp: 'TEST5',
        departure: 'sandy-fred-meyer',
        arrival: rotate(ARRIVALS_NORDIC, i),
        network: 'network-NORDIC',
        departureTime: timeStr(7, 0),
        arrivalTime: timeStr(8, 30),
        returnTime: timeStr(15, 0),
        totalSeats: 5,
        passengerMhspNums: ['TEST3'],
        status: 'open',
      }))
    }
  })

  // Weekdays next week — 1 ride per day
  nextWeekdays.forEach((date, i) => {
    futureRides.push(buildRide({
      date,
      driverMhsp: weekendDrivers[i % weekendDrivers.length],
      departure: rotate(weekendDeps, i),
      arrival: rotate(ARRIVALS_HP, i),
      network: 'network-HILLPATROL',
      departureTime: timeStr(6, 45),
      arrivalTime: timeStr(8, 15),
      returnTime: timeStr(15, 45),
      totalSeats: 4,
      passengerMhspNums: [],
      status: 'open',
    }))
  })

  // Knox modification scenario (TEST7) — 2 future rides with description notes
  const knoxDates = [upcomingSaturdays[1] || daysFromNow(8), upcomingSundays[1] || daysFromNow(9)]
  knoxDates.forEach((date, i) => {
    futureRides.push(buildRide({
      date,
      driverMhsp: 'TEST7',
      departure: 'sandy-fred-meyer',
      arrival: 'buzz-bowman',
      network: 'network-HILLPATROL',
      departureTime: timeStr(7, 0),
      arrivalTime: timeStr(8, 30),
      returnTime: timeStr(16, 0),
      totalSeats: 3,
      passengerMhspNums: ['TEST4'],
      status: 'open',
      description: i === 0
        ? 'Updated: pickup changed to Sandy Safeway (was Powell Butte). Apologies for any confusion.'
        : 'Updated: departure time moved to 07:30 (was 07:00). Departure from same spot.',
    }))
  })

  console.log(`  Generated ${futureRides.length} future ride objects`)

  // ── Step 7: Write everything to Firestore ─────────────────────────────────────
  const allRides = [...pastRides, ...futureRides]
  const totalBookings = allRides.reduce((sum, r) => sum + r.bookings.length, 0)

  if (DRY_RUN) {
    console.log(`\n[dry-run] Would write:`)
    console.log(`  ${UNREGISTERED_MEMBERS.length} unregistered member docs`)
    console.log(`  ${USERS.length} Auth users + user docs`)
    console.log(`  ${Object.values(networkMemberships).flat().length} network membership entries`)
    console.log(`  ${allRides.length} rides (${pastRides.length} historical, ${futureRides.length} future)`)
    console.log(`  ${totalBookings} bookings`)
    console.log('\nDone (dry run — nothing written).')
    return
  }

  console.log(`\n6. Writing ${allRides.length} rides and ${totalBookings} bookings to Firestore...`)

  const BATCH_SIZE = 400 // Firestore batch limit is 500 ops
  let ridesBatch = db.batch()
  let batchCount = 0
  let ridesWritten = 0
  let bookingsWritten = 0

  async function flushBatch() {
    if (batchCount > 0) {
      await ridesBatch.commit()
      ridesBatch = db.batch()
      batchCount = 0
    }
  }

  for (const { rideId, rideDoc, bookings } of allRides) {
    ridesBatch.set(db.collection('rides').doc(rideId), rideDoc)
    batchCount++
    ridesWritten++

    for (const { id: bookId, doc: bookDoc } of bookings) {
      ridesBatch.set(db.collection('bookings').doc(bookId), bookDoc)
      batchCount++
      bookingsWritten++
    }

    if (batchCount >= BATCH_SIZE) await flushBatch()
  }

  await flushBatch()

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n=== Seed complete ===')
  console.log(`  Unregistered members : ${UNREGISTERED_MEMBERS.length}`)
  console.log(`  Auth users created   : ${USERS.length}`)
  console.log(`  Rides created        : ${ridesWritten} (${pastRides.length} historical, ${futureRides.length} future)`)
  console.log(`  Bookings created     : ${bookingsWritten}`)
  console.log(`\nTest accounts: ${testEmail('{1-7}')} / <TEST_PASSWORD>`)
  console.log('Run clearTestData.mjs to remove all test data.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
