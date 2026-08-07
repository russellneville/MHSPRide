// See firestore.rules for the security rules this page depends on — admins can
// read/update members/{memberId} directly, but this page routes writes through
// the Admin SDK (app/api/admin/update-roster-record) to centralize validation,
// same as the Users detail page does for users/{uid}.
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db, auth } from '@/lib/firebaseClient'
import { doc, onSnapshot } from 'firebase/firestore'
import { logEvent } from '@/lib/activityLog'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { NAME_MAX_LENGTH, EMAIL_MAX_LENGTH, TEXTAREA_MAX_LENGTH } from '@/lib/utils'
import { toast } from 'sonner'

function googleMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

export default function AdminRosterDetailPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <RosterDetailContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function RosterDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [record, setRecord] = useState({
    firstName: '', lastName: '', email: '', address: '', status: '', classifications: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'members', id),
      snap => {
        if (!snap.exists()) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const data = { id: snap.id, ...snap.data() }
        setMember(data)
        setRecord({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          address: data.address || '',
          status: data.status || '',
          classifications: (data.classifications || []).join(', '),
        })
        setLoading(false)
      },
      err => {
        console.error('[admin roster detail]', err)
        setLoading(false)
      }
    )
    return unsub
  }, [id])

  const handleChange = e => {
    setRecord(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const handleSave = async () => {
    if (!record.lastName.trim() || !record.email.trim()) {
      toast.error('Last name and Troopiter email are required')
      return
    }
    setSaving(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/admin/update-roster-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id,
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          address: record.address,
          status: record.status,
          classifications: record.classifications.split(',').map(c => c.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not update roster record')

      toast.success('Roster record updated')
      logEvent({
        type: 'admin.roster_updated',
        message: `Roster record updated for ${record.firstName} ${record.lastName}`.trim(),
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { targetMhspNumber: id },
      }).catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/admin/roster')} className="-ml-2">
        <ArrowLeft className="size-4" /> Back to Roster
      </Button>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : notFound ? (
        <p className="text-center text-muted-foreground py-8">Roster record not found.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">{member?.lastName}, {member?.firstName}</h2>
            <Badge variant="outline" className="font-mono">{member?.mhspNumber ? `MHSP #${member.mhspNumber}` : member?.email}</Badge>
            {member?.claimed && <Badge variant="default">Registered</Badge>}
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={record.firstName} onChange={handleChange} maxLength={NAME_MAX_LENGTH} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={record.lastName} onChange={handleChange} maxLength={NAME_MAX_LENGTH} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Troopiter email</Label>
              <Input id="email" type="email" value={record.email} onChange={handleChange} maxLength={EMAIL_MAX_LENGTH} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={record.address} onChange={handleChange} maxLength={TEXTAREA_MAX_LENGTH} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" value={record.status} onChange={handleChange} maxLength={NAME_MAX_LENGTH} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classifications">Classifications</Label>
                <Input id="classifications" value={record.classifications} onChange={handleChange} maxLength={TEXTAREA_MAX_LENGTH} />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>
            </div>

            {member?.latitude != null && member?.longitude != null && (
              <p className="text-sm text-muted-foreground">
                Location:{' '}
                <a
                  href={googleMapsUrl(member.latitude, member.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {member.latitude.toFixed(5)}, {member.longitude.toFixed(5)}
                </a>
                <span className="block text-xs">Recalculated automatically when the address changes.</span>
              </p>
            )}

            {member?.claimed && member?.claimedBy && (
              <p className="text-sm">
                <Button variant="link" className="h-auto p-0" onClick={() => router.push(`/dashboard/admin/users/${member.claimedBy}`)}>
                  View linked user account
                </Button>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end bg-background py-3">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </>
      )}
    </div>
  )
}
