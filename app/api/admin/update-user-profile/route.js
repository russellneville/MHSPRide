import { NextResponse } from 'next/server'
import { verifyAdminRequest, isSuperAdminUser } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { NAME_MAX_LENGTH, PHONE_MAX_LENGTH, TEXTAREA_MAX_LENGTH } from '@/lib/utils'
import { sanitizeVehicleName, VEHICLE_PLATE_MAX_LENGTH, STORAGE_OPTIONS } from '@/lib/vehicles'

// An admin can edit a member's profile fields, but only a super-admin can edit
// another admin or super-admin's profile — same privilege boundary as the role
// and suspend actions in app/api/admin/update-user.
export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  try {
    const { uid, fullname, phone, bio, vehicles } = await request.json()
    if (!uid) return NextResponse.json({ error: 'uid is required' }, { status: 400 })

    const db = getAdminDb()
    const userRef = db.collection('users').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (['admin', 'super-admin'].includes(userSnap.data().role) && !(await isSuperAdminUser(auth.uid))) {
      return NextResponse.json({ error: 'Only super-admins can edit an admin’s profile' }, { status: 403 })
    }

    const updates = {}
    if (fullname !== undefined) {
      if (typeof fullname !== 'string' || fullname.length > NAME_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid full name' }, { status: 400 })
      }
      updates.fullname = fullname
    }
    if (phone !== undefined) {
      if (typeof phone !== 'string' || phone.length > PHONE_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }
      updates.phone = phone
    }
    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > TEXTAREA_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid bio' }, { status: 400 })
      }
      updates.bio = bio
    }
    if (vehicles !== undefined) {
      if (!Array.isArray(vehicles)) {
        return NextResponse.json({ error: 'Invalid vehicles' }, { status: 400 })
      }
      updates.vehicles = vehicles.map(v => ({
        id: typeof v?.id === 'string' ? v.id : '',
        make: sanitizeVehicleName(v?.make),
        model: sanitizeVehicleName(v?.model),
        year: typeof v?.year === 'string' ? v.year.slice(0, 4) : '',
        color: typeof v?.color === 'string' ? v.color.slice(0, 20) : '',
        seats: typeof v?.seats === 'number' ? v.seats : '',
        plate: typeof v?.plate === 'string' ? v.plate.slice(0, VEHICLE_PLATE_MAX_LENGTH) : '',
        storage: Array.isArray(v?.storage) ? v.storage.filter(s => STORAGE_OPTIONS.some(o => o.value === s)) : [],
        isDefault: !!v?.isDefault,
      }))
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await userRef.update(updates)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin/update-user-profile]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
