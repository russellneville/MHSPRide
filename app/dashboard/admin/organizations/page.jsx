'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import SuperAdminGuard from '@/components/SuperAdminGuard'
import { auth, db } from '@/lib/firebaseClient'
import { collection, getDocs } from 'firebase/firestore'
import { usePopup } from '@/context/PopupContext'
import { useAuth } from '@/context/AuthContext'
import { logEvent } from '@/lib/activityLog'
import { TROOPITER_ORG_ID } from '@/lib/skin'
import AddOrganizationPopup from '@/components/popup-forms/AddOrganizationPopup'
import EditOrganizationPopup from '@/components/popup-forms/EditOrganizationPopup'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminOrganizationsPage() {
  return (
    <SuperAdminGuard>
      <DashboardLayout>
        <OrganizationsContent />
      </DashboardLayout>
    </SuperAdminGuard>
  )
}

function OrganizationsContent() {
  const { openPopup } = usePopup()
  const { user: currentUser } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function fetchOrgs() {
    setLoading(true)
    return getDocs(collection(db, 'organizations'))
      .then(snap => {
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
        setOrgs(rows)
      })
      .catch(err => console.error('[admin/organizations]', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrgs()
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/admin/organizations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete organization')

      logEvent({
        type: 'organization.deleted',
        message: `Organization deleted: ${deleteTarget.displayName}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { orgId: deleteTarget.id },
      }).catch(() => {})

      setOrgs(prev => prev.filter(o => o.id !== deleteTarget.id))
      toast.success(`Deleted ${deleteTarget.displayName}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Organizations</h3>
          <p className="text-sm text-muted-foreground">
            Patrols with the Troopiter carpool add-on. Only <span className="font-mono">{TROOPITER_ORG_ID}</span> is
            currently live on the Troopiter skin — others are configured but dormant until multi-org session
            resolution ships.
          </p>
        </div>
        <Button size="sm" onClick={() => openPopup('Add organization', <AddOrganizationPopup onSaved={fetchOrgs} />)}>
          Add Organization
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading organizations…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Org ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No organizations yet.
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map(org => (
                  <TableRow key={org.id}>
                    <TableCell>
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.displayName} className="h-8 w-8 rounded object-contain bg-white border" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{org.displayName}</TableCell>
                    <TableCell className="font-mono text-sm">{org.id}</TableCell>
                    <TableCell>
                      {org.id === TROOPITER_ORG_ID ? (
                        <Badge>Live on Troopiter skin</Badge>
                      ) : (
                        <Badge variant="outline">Configured, not live</Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${org.displayName}`}
                        onClick={() => openPopup('Edit organization', <EditOrganizationPopup org={org} onSaved={fetchOrgs} />)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${org.displayName}`}
                        disabled={org.id === TROOPITER_ORG_ID}
                        onClick={() => setDeleteTarget(org)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the org's config doc (logo/display name). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
