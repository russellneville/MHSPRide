import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { geocodeAddress } from '@/lib/geocodeAddress'
import { NAME_MAX_LENGTH, EMAIL_MAX_LENGTH, TEXTAREA_MAX_LENGTH } from '@/lib/utils'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  try {
    const { id, firstName, lastName, email, address, status, classifications } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = getAdminDb()
    const memberRef = db.collection('members').doc(id)
    const memberSnap = await memberRef.get()
    if (!memberSnap.exists) return NextResponse.json({ error: 'Roster record not found' }, { status: 404 })

    const updates = {}
    if (firstName !== undefined) {
      if (typeof firstName !== 'string' || firstName.length > NAME_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid first name' }, { status: 400 })
      }
      updates.firstName = firstName.trim()
    }
    if (lastName !== undefined) {
      if (typeof lastName !== 'string' || !lastName.trim() || lastName.length > NAME_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid last name' }, { status: 400 })
      }
      updates.lastName = lastName.trim()
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim() || email.length > EMAIL_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
      }
      updates.email = email.trim()
    }
    if (status !== undefined) {
      if (typeof status !== 'string' || status.length > NAME_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = status.trim()
    }
    if (classifications !== undefined) {
      if (!Array.isArray(classifications) || classifications.some(c => typeof c !== 'string' || c.length > NAME_MAX_LENGTH)) {
        return NextResponse.json({ error: 'Invalid classifications' }, { status: 400 })
      }
      updates.classifications = classifications.map(c => c.trim()).filter(Boolean)
    }
    if (address !== undefined) {
      if (typeof address !== 'string' || address.length > TEXTAREA_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
      }
      const trimmedAddress = address.trim()
      const addressChanged = trimmedAddress !== (memberSnap.data().address || '')
      updates.address = trimmedAddress

      if (addressChanged) {
        if (!trimmedAddress) {
          updates.latitude = null
          updates.longitude = null
        } else {
          try {
            const coords = await geocodeAddress(trimmedAddress)
            updates.latitude = coords.latitude
            updates.longitude = coords.longitude
          } catch (err) {
            console.warn(`[update-roster-record] geocode failed for "${trimmedAddress}":`, err.message)
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await memberRef.update(updates)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin/update-roster-record]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
