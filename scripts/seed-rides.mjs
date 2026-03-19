/**
 * Seed script — generates 10 future + 35 past rides for a driver.
 * Usage:
 *   SEED_PASSWORD=yourpassword node scripts/seed-rides.mjs
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import 'dotenv/config'

const EMAIL = 'russellneville@gmail.com'
const PASSWORD = process.env.SEED_PASSWORD

if (!PASSWORD) {
  console.error('Set SEED_PASSWORD env var before running.')
  process.exit(1)
}

const app = initializeApp({
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
})
const auth = getAuth(app)
const db   = getFirestore(app)

// ── Helpers ──────────────────────────────────────────────────────────────────

function rideId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `ride-${code}`
}

function dateStr(daysFromToday) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

function pad(n) { return String(n).padStart(2, '0') }

function timeStr(h, m = 0) { return `${pad(h)}:${pad(m)}` }

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return timeStr(Math.floor(total / 60) % 24, total % 60)
}

// ── Location pools ────────────────────────────────────────────────────────────

const DEPARTURES = [
  'troutdale-fred-meyer', 'hoodland-thriftway', 'sandy-bi-mart',
  'gresham-transit', 'powell-butte', 'clackamas-tc',
  'buzz-bowman-center', 'welches-rd',
]

const ARRIVALS = [
  'timberline', 'ski-bowl', 'meadows', 'summit-pass', 'tea-cup', 'buzz-bowman',
]

const NOTES = [
  'Return time is flexible.',
  'Meet at the main entrance.',
  'Ski gear fits in the roof box.',
  'Leaving promptly — please be on time.',
  'Happy to adjust pickup spot.',
  '',
  '',
  '',
]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ── Build ride objects ────────────────────────────────────────────────────────

function makeRide(driver, uid, daysOffset, status) {
  const dep    = pick(DEPARTURES)
  const arr    = pick(ARRIVALS.filter(a => a !== dep))
  const depH   = 5 + Math.floor(Math.random() * 4)         // 5am–8am
  const depM   = pick([0, 15, 30, 45])
  const depT   = timeStr(depH, depM)
  const arrT   = addMinutes(depT, 60 + Math.floor(Math.random() * 60))
  const retT   = addMinutes(arrT, 240 + Math.floor(Math.random() * 180)) // ~4–7h later
  const seats  = 1 + Math.floor(Math.random() * 4)
  const booked = status === 'not started' ? Math.floor(Math.random() * (seats + 1)) : seats
  const avail  = seats - booked
  const d      = dateStr(daysOffset)

  return {
    departure:             dep,
    arrival:               arr,
    departure_date:        d,
    arrival_date:          d,
    departure_time:        depT,
    arrival_time:          arrT,
    return_departure_time: retT,
    one_way:               false,
    total_seats:           seats,
    available_seats:       avail,
    ride_status:           status,
    ride_description:      pick(NOTES),
    network_id:            'network-MOUNTAINHOSTS',
    driverId:              uid,
    driver:                { ...driver, id: uid },
    passengers:            [],
    started_at:            '',
    finished_at:           '',
    created_at:            new Date(),
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Signing in…')
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
  const uid = user.uid
  console.log('UID:', uid)

  const snap = await getDoc(doc(db, 'users', uid))
  const driver = snap.data()
  console.log('Driver:', driver.fullname)

  const rides = [
    // 10 future — spread 1–60 days out
    ...Array.from({ length: 10 }, (_, i) => ({
      offset: 2 + i * 5,
      status: 'not started',
    })),
    // 35 past — spread 1–180 days back
    ...Array.from({ length: 35 }, (_, i) => ({
      offset: -(1 + i * 5),
      status: i % 7 === 0 ? 'canceled' : 'completed',
    })),
  ]

  for (const { offset, status } of rides) {
    const id   = rideId()
    const data = makeRide(driver, uid, offset, status)
    await setDoc(doc(db, 'rides', id), data)
    console.log(`  ✓ ${id}  ${data.departure_date}  ${data.departure} → ${data.arrival}  [${status}]`)
  }

  console.log('\nDone — 45 rides created.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
