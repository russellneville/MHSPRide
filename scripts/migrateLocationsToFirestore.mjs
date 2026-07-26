/**
 * migrateLocationsToFirestore.mjs
 *
 * One-time migration for issue #66: seeds Firestore `locations` and
 * `driveTimes` collections from what used to be the static LOCATIONS /
 * ARRIVAL_LOCATIONS arrays (lib/locations.js) and DRIVE_TIMES matrix
 * (lib/drive-times.js), before those became the runtime-managed admin
 * Locations page. The data below is a frozen snapshot of those files as of
 * 2026-07-26 — existing ids are preserved so current rides/bookings (which
 * store these ids as departure/arrival) keep resolving correctly.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json (Firebase Admin service account)
 *
 * Usage:
 *   node scripts/migrateLocationsToFirestore.mjs
 *   node scripts/migrateLocationsToFirestore.mjs --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const DRY_RUN = process.argv.includes('--dry-run')

const serviceAccount = require('./serviceAccountKey.json')
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const LOCATIONS = [
  { id: "powell-butte",            name: "Powell Butte Park & Ride",              address: "SE 162nd Ave & SE Powell Blvd, Portland OR 97236",  lat: 45.4947932, lon: -122.4966988 },
  { id: "clackamas-tc",            name: "Clackamas Town Center MAX Park & Ride",  address: "SE 82nd Ave & Sunnyside Rd, Clackamas OR 97015",     lat: 45.4331658, lon: -122.579242  },
  { id: "troutdale-fred-meyer",    name: "Troutdale Fred Meyer",                   address: "1500 NW Graham Rd, Troutdale OR 97060",              lat: 45.5515379, lon: -122.3880687 },
  { id: "sandy-fred-meyer",        name: "Sandy Fred Meyer",                      address: "37555 OR-211, Sandy OR 97055",                       lat: 45.3895446, lon: -122.2634993 },
  { id: "sandy-safeway",           name: "Sandy Safeway",                         address: "37530 US-26, Sandy OR 97055",                        lat: 45.3973402, lon: -122.2683607 },
  { id: "zigzag-ranger-station",   name: "Zigzag Ranger Station",                 address: "70220 E US-26, Zigzag OR 97049",                     lat: 45.3428437, lon: -121.9415786 },
  { id: "hoodland-thriftway",      name: "Hoodland Thriftway",                    address: "68280 US-26, Welches OR 97067",                      lat: 45.3476142, lon: -121.9628787 },
  { id: "chevron-govt-camp",       name: "Chevron Government Camp",               address: "90149 Government Camp Loop, Government Camp OR 97028", lat: 45.302644,  lon: -121.7466654 },
  { id: "buzz-bowman-center",      name: "Buzz Bowman Center",                    address: "87622 Government Camp Loop, Government Camp OR 97028", lat: 45.3048918, lon: -121.7590055 },
  { id: "sandy-bi-mart",           name: "Sandy Bi-Mart",                         address: "37110 US-26, Sandy OR 97055",                        lat: 45.3973,    lon: -122.2635    },
  { id: "gresham-transit",         name: "Gresham Transit Center",                address: "140 NW Eastman Pkwy, Gresham OR 97030",              lat: 45.5024,    lon: -122.4305    },
  { id: "welches-rd",              name: "Welches Road Park & Ride",              address: "Welches Rd, Welches OR 97067",                       lat: 45.3513,    lon: -121.9737    },
  { id: "hood-river-safeway",      name: "Hood River Westside Safeway",           address: "2249 Cascade Ave, Hood River OR 97031",              lat: 45.7087368, lon: -121.5349924 },
  { id: "timberline-lodge",        name: "Timberline Lodge",                      address: "Timberline Lodge, Government Camp OR 97028",         lat: 45.3311281, lon: -121.7110064 },
]

const ARRIVAL_LOCATIONS = [
  { id: "buzz-bowman",  name: "Buzz Bowman Ski Patrol Building", lat: 45.3048918, lon: -121.7590055 },
  { id: "summit-pass",  name: "Summit Pass",                     lat: 45.3029059, lon: -121.7458283 },
  { id: "timberline",   name: "Timberline",                      lat: 45.3311281, lon: -121.7110064 },
  { id: "ski-bowl",     name: "Ski Bowl",                        lat: 45.3019084, lon: -121.773296  },
  { id: "meadows",      name: "Meadows",                         lat: 45.3317552, lon: -121.6651848 },
  { id: "tea-cup",      name: "Tea Cup",                         lat: 45.3203457, lon: -121.6231353 },
]

// Per issue #66: the only two networks with a default arrival destination today.
const DEFAULT_FOR_NETWORK = {
  'tea-cup': 'network-NORDIC',
  'timberline': 'network-MOUNTAINBIKING',
}

const DRIVE_TIMES = {
  "powell-butte":            { "buzz-bowman": 57, "summit-pass": 59, "timberline": 68, "ski-bowl": 57, "meadows": 72, "tea-cup": 69 },
  "clackamas-tc":            { "buzz-bowman": 61, "summit-pass": 63, "timberline": 72, "ski-bowl": 61, "meadows": 76, "tea-cup": 73 },
  "troutdale-fred-meyer":    { "buzz-bowman": 58, "summit-pass": 60, "timberline": 70, "ski-bowl": 58, "meadows": 73, "tea-cup": 70 },
  "sandy-fred-meyer":        { "buzz-bowman": 32, "summit-pass": 34, "timberline": 44, "ski-bowl": 32, "meadows": 47, "tea-cup": 44 },
  "sandy-safeway":           { "buzz-bowman": 35, "summit-pass": 36, "timberline": 46, "ski-bowl": 34, "meadows": 49, "tea-cup": 47 },
  "zigzag-ranger-station":   { "buzz-bowman": 13, "summit-pass": 15, "timberline": 25, "ski-bowl": 13, "meadows": 28, "tea-cup": 26 },
  "hoodland-thriftway":      { "buzz-bowman": 15, "summit-pass": 17, "timberline": 26, "ski-bowl": 15, "meadows": 30, "tea-cup": 27 },
  "chevron-govt-camp":       { "buzz-bowman": 2,  "summit-pass": 4,  "timberline": 12, "ski-bowl": 4,  "meadows": 15, "tea-cup": 13 },
  "buzz-bowman-center":      { "buzz-bowman": 0,  "summit-pass": 5,  "timberline": 13, "ski-bowl": 3,  "meadows": 17, "tea-cup": 14 },
  "sandy-bi-mart":           { "buzz-bowman": 34, "summit-pass": 35, "timberline": 45, "ski-bowl": 33, "meadows": 48, "tea-cup": 46 },
  "gresham-transit":         { "buzz-bowman": 51, "summit-pass": 53, "timberline": 62, "ski-bowl": 51, "meadows": 66, "tea-cup": 63 },
  "welches-rd":              { "buzz-bowman": 15, "summit-pass": 17, "timberline": 26, "ski-bowl": 15, "meadows": 30, "tea-cup": 27 },
  "hood-river-safeway":      { "buzz-bowman": 53, "summit-pass": 52, "timberline": 61, "ski-bowl": 54, "meadows": 45, "tea-cup": 40 },
  "buzz-bowman": { "powell-butte": 57, "clackamas-tc": 61, "troutdale-fred-meyer": 55, "sandy-fred-meyer": 32, "sandy-safeway": 32, "zigzag-ranger-station": 13, "hoodland-thriftway": 15, "chevron-govt-camp": 2,  "buzz-bowman-center": 0,  "sandy-bi-mart": 32, "gresham-transit": 51, "welches-rd": 15, "hood-river-safeway": 53 },
  "summit-pass":  { "powell-butte": 59, "clackamas-tc": 62, "troutdale-fred-meyer": 56, "sandy-fred-meyer": 34, "sandy-safeway": 34, "zigzag-ranger-station": 15, "hoodland-thriftway": 16, "chevron-govt-camp": 1,  "buzz-bowman-center": 3,  "sandy-bi-mart": 33, "gresham-transit": 52, "welches-rd": 16, "hood-river-safeway": 51 },
  "timberline":   { "powell-butte": 68, "clackamas-tc": 72, "troutdale-fred-meyer": 66, "sandy-fred-meyer": 43, "sandy-safeway": 43, "zigzag-ranger-station": 24, "hoodland-thriftway": 26, "chevron-govt-camp": 11, "buzz-bowman-center": 13, "sandy-bi-mart": 43, "gresham-transit": 62, "welches-rd": 26, "hood-river-safeway": 61 },
  "ski-bowl":     { "powell-butte": 57, "clackamas-tc": 61, "troutdale-fred-meyer": 55, "sandy-fred-meyer": 32, "sandy-safeway": 32, "zigzag-ranger-station": 13, "hoodland-thriftway": 15, "chevron-govt-camp": 3,  "buzz-bowman-center": 2,  "sandy-bi-mart": 32, "gresham-transit": 51, "welches-rd": 15, "hood-river-safeway": 53 },
  "meadows":      { "powell-butte": 71, "clackamas-tc": 75, "troutdale-fred-meyer": 69, "sandy-fred-meyer": 46, "sandy-safeway": 46, "zigzag-ranger-station": 27, "hoodland-thriftway": 29, "chevron-govt-camp": 14, "buzz-bowman-center": 16, "sandy-bi-mart": 46, "gresham-transit": 65, "welches-rd": 29, "hood-river-safeway": 45 },
  "tea-cup":      { "powell-butte": 70, "clackamas-tc": 73, "troutdale-fred-meyer": 67, "sandy-fred-meyer": 45, "sandy-safeway": 45, "zigzag-ranger-station": 26, "hoodland-thriftway": 27, "chevron-govt-camp": 13, "buzz-bowman-center": 14, "sandy-bi-mart": 44, "gresham-transit": 63, "welches-rd": 27, "hood-river-safeway": 39 },
}

async function migrateLocations() {
  const batch = db.batch()

  for (const loc of LOCATIONS) {
    const ref = db.collection('locations').doc(loc.id)
    batch.set(ref, {
      name: loc.name,
      role: 'origin',
      address: loc.address || '',
      lat: loc.lat,
      lon: loc.lon,
      defaultForNetworkId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  for (const loc of ARRIVAL_LOCATIONS) {
    const ref = db.collection('locations').doc(loc.id)
    batch.set(ref, {
      name: loc.name,
      role: 'destination',
      address: '',
      lat: loc.lat,
      lon: loc.lon,
      defaultForNetworkId: DEFAULT_FOR_NETWORK[loc.id] || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  console.log(`locations: ${LOCATIONS.length} origins + ${ARRIVAL_LOCATIONS.length} destinations`)
  if (!DRY_RUN) await batch.commit()
}

async function migrateDriveTimes() {
  const batch = db.batch()

  for (const [fromId, times] of Object.entries(DRIVE_TIMES)) {
    const ref = db.collection('driveTimes').doc(fromId)
    batch.set(ref, times, { merge: true })
  }

  console.log(`driveTimes: ${Object.keys(DRIVE_TIMES).length} location docs`)
  if (!DRY_RUN) await batch.commit()
}

if (DRY_RUN) console.log('── DRY RUN — no writes will be made ──')

await migrateLocations()
await migrateDriveTimes()

console.log(DRY_RUN ? '\n✓ Dry run complete.' : '\n✓ Migration complete.')
