// See firestore.rules for the security rules this page depends on — admins can
// read any users/{uid} doc, but writes to another user's doc always go through
// the Admin SDK (app/api/admin/update-user-profile), never the client SDK.
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import DriverProfile from '@/components/forms/DriverProfile'
import ProfileForm, { PROFILE_SECTION_CARD_CLASS } from '@/components/forms/ProfileForm'
import { db, auth } from '@/lib/firebaseClient'
import { doc, onSnapshot } from 'firebase/firestore'
import { getVehicles } from '@/lib/vehicles'
import { logEvent } from '@/lib/activityLog'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { resolveLivePhotoUrl } from '@/lib/profilePhoto'
import { toast } from 'sonner'

export default function AdminUserDetailPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <UserDetailContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function UserDetailContent() {
  const { uid } = useParams()
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [targetUser, setTargetUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [profile, setProfile] = useState({ fullname: '', bio: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [photoSrc, setPhotoSrc] = useState(null)
  const [photoTriedLive, setPhotoTriedLive] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      snap => {
        if (!snap.exists()) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const data = { uid: snap.id, ...snap.data() }
        setTargetUser(data)
        setProfile(prev => ({ ...prev, ...data, vehicles: getVehicles(data) }))
        setLoading(false)
      },
      err => {
        console.error('[admin user detail]', err)
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  useEffect(() => {
    setPhotoSrc(targetUser?.photoURL || null)
    setPhotoTriedLive(false)
  }, [targetUser?.photoURL])

  const handlePhotoError = () => {
    if (!photoTriedLive && targetUser?.uid) {
      setPhotoTriedLive(true)
      resolveLivePhotoUrl(targetUser.uid).then(setPhotoSrc)
    } else {
      setPhotoSrc(null)
    }
  }

  const isSuperAdmin = currentUser?.role === 'super-admin'
  const targetIsPrivileged = ['admin', 'super-admin'].includes(targetUser?.role)
  const readOnly = targetIsPrivileged && !isSuperAdmin

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/admin/update-user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid,
          fullname: profile.fullname,
          phone: profile.phone,
          bio: profile.bio,
          vehicles: profile.vehicles,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not update user')

      toast.success('Profile updated')
      logEvent({
        type: 'admin.profile_updated',
        message: `Profile updated for ${targetUser?.fullname}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { targetUserId: uid, targetUserName: targetUser?.fullname },
      }).catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/users')} className="-ml-2">
        <ArrowLeft className="size-4" /> Back to Users
      </Button>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : notFound ? (
        <p className="text-center text-muted-foreground py-8">User not found.</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold">{targetUser?.fullname || 'User'}</h2>

          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Only a super-admin can edit {targetUser?.role === 'super-admin' ? 'a super-admin' : 'an admin'}'s profile.
            </p>
          )}

          <fieldset disabled={readOnly} className="contents">
            <ProfileForm
              profile={profile}
              setProfile={setProfile}
              displayName={targetUser?.fullname}
              photoSrc={photoSrc}
              onPhotoError={handlePhotoError}
            />

            <DriverProfile profile={profile} setProfile={setProfile} className={`mt-4 ${PROFILE_SECTION_CARD_CLASS}`} />
          </fieldset>

          {!readOnly && (
            <div className="flex items-center justify-end bg-background py-3">
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
