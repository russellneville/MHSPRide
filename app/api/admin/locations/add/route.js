import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

// Ported from scripts/buildDriveTimes.mjs — same Directions API call, same
// 10 QPS throttle, now run on demand instead of offline.
async function getDriveMinutes(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set')

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', `${origin.lat},${origin.lon}`)
  url.searchParams.set('destination', `${destination.lat},${destination.lon}`)
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(`Directions API error: ${data.status} — ${data.error_message || ''}`)
  }

  const seconds = data.routes[0].legs[0].duration.value
  return Math.round(seconds / 60)
}

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// A location can pair with another as (departure, arrival) if one can act as
// an origin and the other as a destination — 'both' can act as either.
const canBeOrigin = (role) => role === 'origin' || role === 'both'
const canBeDestination = (role) => role === 'destination' || role === 'both'
const canPair = (roleA, roleB) =>
  (canBeOrigin(roleA) && canBeDestination(roleB)) || (canBeDestination(roleA) && canBeOrigin(roleB))

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  const { name, role, address, lat, lon } = await request.json()

  const trimmedName = String(name || '').trim()
  const latitude = Number(lat)
  const longitude = Number(lon)

  if (!trimmedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (role !== 'origin' && role !== 'destination' && role !== 'both') {
    return NextResponse.json({ error: 'Role must be "origin", "destination", or "both"' }, { status: 400 })
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'Valid lat/lon are required' }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const baseId = slugify(trimmedName)
    if (!baseId) {
      return NextResponse.json({ error: 'Could not derive an id from the name' }, { status: 400 })
    }

    let id = baseId
    let suffix = 2
    while ((await db.collection('locations').doc(id).get()).exists) {
      id = `${baseId}-${suffix++}`
    }

    const allSnap = await db.collection('locations').get()
    const partners = allSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(other => canPair(role, other.role))

    const newLocation = { lat: latitude, lon: longitude }
    const driveTimesForNew = {}
    const driveTimeErrors = []

    for (const other of partners) {
      try {
        const newToOther = await getDriveMinutes(newLocation, other)
        const otherToNew = await getDriveMinutes(other, newLocation)

        driveTimesForNew[other.id] = newToOther
        await db.collection('driveTimes').doc(other.id).set({ [id]: otherToNew }, { merge: true })
      } catch (err) {
        console.error(`[locations/add] drive time ${id} <-> ${other.id}:`, err.message)
        driveTimeErrors.push(other.id)
        driveTimesForNew[other.id] = null
      }
      // Stay well under the Directions API's 10 QPS limit
      await new Promise(r => setTimeout(r, 120))
    }

    await db.collection('locations').doc(id).set({
      name: trimmedName,
      role,
      address: canBeOrigin(role) ? String(address || '').trim() : '',
      lat: latitude,
      lon: longitude,
      defaultForNetworkId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await db.collection('driveTimes').doc(id).set(driveTimesForNew)

    return NextResponse.json({ ok: true, id, driveTimeErrors })
  } catch (err) {
    console.error('[admin/locations/add]', err)
    return NextResponse.json({ error: err.message || 'Could not add location' }, { status: 500 })
  }
}
