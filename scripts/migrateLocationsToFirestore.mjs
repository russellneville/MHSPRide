/**
 * migrateLocationsToFirestore.mjs
 *
 * Recreates the Firestore `locations` and `driveTimes` collections from
 * scratch — for bootstrapping a brand-new project (or recovering a wiped
 * one) without needing another project's data to copy from. Originally a
 * one-time migration for issue #66 (seeding these collections from what
 * used to be static LOCATIONS / ARRIVAL_LOCATIONS / DRIVE_TIMES arrays
 * before those became runtime-managed via the admin Locations page).
 *
 * The data below is a snapshot of production (`mhspride`) as of 2026-08-03,
 * refreshed for issue #191 after the original 2026-07-26 snapshot drifted
 * out of sync with admin edits made since (a renamed/re-geocoded Clackamas
 * stop, "Buzz Bowman" and "Buzz Bowman Center" merged into one `role: 'both'`
 * location, "Timberline Lodge" removed). If prod's locations have since
 * moved on again, prefer `scripts/syncLocationsToTest.mjs` (copies live prod
 * data into mhspride-test) over updating this frozen snapshot — this script
 * is for the from-scratch case only.
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

// role: 'origin' | 'destination' | 'both'. defaultForNetworkId is the only
// two networks with a default arrival destination today (issue #66).
const LOCATIONS = [
  { id: "powell-butte",                          name: "Powell Butte Park & Ride",             role: "origin",      address: "SE 162nd Ave & SE Powell Blvd, Portland OR 97236",   lat: 45.4947932, lon: -122.4966988 },
  { id: "clackamas-town-center-transit-center",  name: "Clackamas Town Center Transit Center", role: "origin",      address: "45.4297774,-122.5838134",                             lat: 45.4312413, lon: -122.5828227 },
  { id: "troutdale-fred-meyer",                  name: "Troutdale Fred Meyer",                  role: "origin",      address: "1500 NW Graham Rd, Troutdale OR 97060",               lat: 45.5515379, lon: -122.3880687 },
  { id: "sandy-fred-meyer",                      name: "Sandy Fred Meyer",                      role: "origin",      address: "37555 OR-211, Sandy OR 97055",                        lat: 45.3895446, lon: -122.2634993 },
  { id: "sandy-safeway",                         name: "Sandy Safeway",                         role: "origin",      address: "37530 US-26, Sandy OR 97055",                         lat: 45.3973402, lon: -122.2683607 },
  { id: "zigzag-ranger-station",                 name: "Zigzag Ranger Station",                 role: "origin",      address: "70220 E US-26, Zigzag OR 97049",                      lat: 45.3428437, lon: -121.9415786 },
  { id: "hoodland-thriftway",                    name: "Hoodland Thriftway",                    role: "origin",      address: "68280 US-26, Welches OR 97067",                       lat: 45.3476142, lon: -121.9628787 },
  { id: "chevron-govt-camp",                     name: "Government Camp (Govy) Chevron",        role: "origin",      address: "90149 Government Camp Loop, Government Camp OR 97028", lat: 45.302644,  lon: -121.7466654 },
  { id: "buzz-bowman-center",                    name: "Buzz Bowman Ski Patrol Building",       role: "both",        address: "87622 Government Camp Loop, Government Camp OR 97028", lat: 45.3048918, lon: -121.7590055 },
  { id: "sandy-bi-mart",                         name: "Sandy Bi-Mart",                         role: "origin",      address: "37110 US-26, Sandy OR 97055",                         lat: 45.3973,    lon: -122.2635    },
  { id: "gresham-transit",                       name: "Gresham Transit Center",                role: "origin",      address: "140 NW Eastman Pkwy, Gresham OR 97030",               lat: 45.5030557, lon: -122.426744  },
  { id: "welches-rd",                            name: "Welches Road Park & Ride",              role: "origin",      address: "Welches Rd, Welches OR 97067",                        lat: 45.3513,    lon: -121.9737    },
  { id: "hood-river-safeway",                    name: "Hood River Westside Safeway",           role: "origin",      address: "2249 Cascade Ave, Hood River OR 97031",               lat: 45.7087368, lon: -121.5349924 },
  { id: "summit-pass",                           name: "Summit Pass",                           role: "destination", address: "",                                                    lat: 45.3029059, lon: -121.7458283 },
  { id: "timberline",                            name: "Timberline",                            role: "destination", address: "",                                                    lat: 45.3311281, lon: -121.7110064, defaultForNetworkId: "network-MOUNTAINBIKING" },
  { id: "ski-bowl",                              name: "Ski Bowl",                              role: "destination", address: "",                                                    lat: 45.3019084, lon: -121.773296  },
  { id: "meadows",                               name: "Meadows",                               role: "destination", address: "",                                                    lat: 45.3317552, lon: -121.6651848 },
  { id: "tea-cup",                               name: "Tea Cup",                               role: "destination", address: "",                                                    lat: 45.3203457, lon: -121.6231353, defaultForNetworkId: "network-NORDIC" },
]

const DRIVE_TIMES = {
  "powell-butte":                         { "buzz-bowman-center": 57, "meadows": 72, "ski-bowl": 57, "summit-pass": 59, "tea-cup": 69, "timberline": 68 },
  "clackamas-town-center-transit-center": { "buzz-bowman-center": 63, "meadows": 78, "ski-bowl": 63, "summit-pass": 65, "tea-cup": 75, "timberline": 74 },
  "troutdale-fred-meyer":                 { "buzz-bowman-center": 58, "meadows": 73, "ski-bowl": 58, "summit-pass": 60, "tea-cup": 70, "timberline": 70 },
  "sandy-fred-meyer":                     { "buzz-bowman-center": 32, "meadows": 47, "ski-bowl": 32, "summit-pass": 34, "tea-cup": 44, "timberline": 44 },
  "sandy-safeway":                        { "buzz-bowman-center": 35, "meadows": 49, "ski-bowl": 34, "summit-pass": 36, "tea-cup": 47, "timberline": 46 },
  "zigzag-ranger-station":                { "buzz-bowman-center": 13, "meadows": 28, "ski-bowl": 13, "summit-pass": 15, "tea-cup": 26, "timberline": 25 },
  "hoodland-thriftway":                   { "buzz-bowman-center": 15, "meadows": 30, "ski-bowl": 15, "summit-pass": 17, "tea-cup": 27, "timberline": 26 },
  "chevron-govt-camp":                    { "buzz-bowman-center": 2,  "meadows": 15, "ski-bowl": 4,  "summit-pass": 4,  "tea-cup": 13, "timberline": 12 },
  "sandy-bi-mart":                        { "buzz-bowman-center": 34, "meadows": 48, "ski-bowl": 33, "summit-pass": 35, "tea-cup": 46, "timberline": 45 },
  "gresham-transit":                      { "buzz-bowman-center": 51, "meadows": 66, "ski-bowl": 51, "summit-pass": 53, "tea-cup": 63, "timberline": 62 },
  "welches-rd":                           { "buzz-bowman-center": 15, "meadows": 30, "ski-bowl": 15, "summit-pass": 17, "tea-cup": 27, "timberline": 26 },
  "hood-river-safeway":                   { "buzz-bowman-center": 53, "meadows": 45, "ski-bowl": 54, "summit-pass": 52, "tea-cup": 40, "timberline": 61 },
  "buzz-bowman-center": { "powell-butte": 57, "clackamas-town-center-transit-center": 63, "troutdale-fred-meyer": 55, "sandy-fred-meyer": 32, "sandy-safeway": 32, "zigzag-ranger-station": 13, "hoodland-thriftway": 15, "chevron-govt-camp": 2,  "sandy-bi-mart": 32, "gresham-transit": 51, "welches-rd": 15, "hood-river-safeway": 53, "meadows": 17, "ski-bowl": 3,  "summit-pass": 5,  "tea-cup": 14, "timberline": 13 },
  "summit-pass":        { "powell-butte": 59, "clackamas-town-center-transit-center": 64, "troutdale-fred-meyer": 56, "sandy-fred-meyer": 34, "sandy-safeway": 34, "zigzag-ranger-station": 15, "hoodland-thriftway": 16, "chevron-govt-camp": 1,  "sandy-bi-mart": 33, "gresham-transit": 52, "welches-rd": 16, "hood-river-safeway": 51, "buzz-bowman-center": 3 },
  "timberline":         { "powell-butte": 68, "clackamas-town-center-transit-center": 74, "troutdale-fred-meyer": 66, "sandy-fred-meyer": 43, "sandy-safeway": 43, "zigzag-ranger-station": 24, "hoodland-thriftway": 26, "chevron-govt-camp": 11, "sandy-bi-mart": 43, "gresham-transit": 62, "welches-rd": 26, "hood-river-safeway": 61, "buzz-bowman-center": 13 },
  "ski-bowl":           { "powell-butte": 57, "clackamas-town-center-transit-center": 63, "troutdale-fred-meyer": 55, "sandy-fred-meyer": 32, "sandy-safeway": 32, "zigzag-ranger-station": 13, "hoodland-thriftway": 15, "chevron-govt-camp": 3,  "sandy-bi-mart": 32, "gresham-transit": 51, "welches-rd": 15, "hood-river-safeway": 53, "buzz-bowman-center": 2 },
  "meadows":            { "powell-butte": 71, "clackamas-town-center-transit-center": 77, "troutdale-fred-meyer": 69, "sandy-fred-meyer": 46, "sandy-safeway": 46, "zigzag-ranger-station": 27, "hoodland-thriftway": 29, "chevron-govt-camp": 14, "sandy-bi-mart": 46, "gresham-transit": 65, "welches-rd": 29, "hood-river-safeway": 45, "buzz-bowman-center": 16 },
  "tea-cup":            { "powell-butte": 70, "clackamas-town-center-transit-center": 75, "troutdale-fred-meyer": 67, "sandy-fred-meyer": 45, "sandy-safeway": 45, "zigzag-ranger-station": 26, "hoodland-thriftway": 27, "chevron-govt-camp": 13, "sandy-bi-mart": 44, "gresham-transit": 63, "welches-rd": 27, "hood-river-safeway": 39, "buzz-bowman-center": 14 },
}

async function migrateLocations() {
  const batch = db.batch()

  for (const loc of LOCATIONS) {
    const ref = db.collection('locations').doc(loc.id)
    batch.set(ref, {
      name: loc.name,
      role: loc.role,
      address: loc.address || '',
      lat: loc.lat,
      lon: loc.lon,
      defaultForNetworkId: loc.defaultForNetworkId || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  console.log(`locations: ${LOCATIONS.length} docs`)
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
