'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import SuperAdminGuard from '@/components/SuperAdminGuard'
import { auth, db } from '@/lib/firebaseClient'
import { collection, getDocs } from 'firebase/firestore'
import { networkName } from '@/lib/networks'
import { usePopup } from '@/context/PopupContext'
import { useAuth } from '@/context/AuthContext'
import { logEvent } from '@/lib/activityLog'
import AddLocationPopup from '@/components/popup-forms/AddLocationPopup'
import EditLocationPopup from '@/components/popup-forms/EditLocationPopup'
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

function googleMapsUrl(lat, lon) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
}

export default function AdminLocationsPage() {
  return (
    <SuperAdminGuard>
      <DashboardLayout>
        <LocationsContent />
      </DashboardLayout>
    </SuperAdminGuard>
  )
}

function LocationsContent() {
  const { openPopup } = usePopup()
  const { user: currentUser } = useAuth()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function fetchLocations() {
    setLoading(true)
    return getDocs(collection(db, 'locations'))
      .then(snap => {
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role.localeCompare(b.role)))
        setLocations(rows)
      })
      .catch(err => console.error('[admin/locations]', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/admin/locations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete location')

      logEvent({
        type: 'location.deleted',
        message: `Location deleted: ${deleteTarget.name}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { locationId: deleteTarget.id, historicalRideCount: data.historicalRideCount },
      }).catch(() => {})

      setLocations(prev => prev.filter(l => l.id !== deleteTarget.id))
      toast.success(
        data.historicalRideCount > 0
          ? `Deleted ${deleteTarget.name}. ${data.historicalRideCount} past ride${data.historicalRideCount !== 1 ? 's' : ''} that used it will show a fallback name.`
          : `Deleted ${deleteTarget.name}`
      )
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
        <h3 className="text-xl font-semibold">Locations</h3>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-muted-foreground">{locations.length} locations</span>
          )}
          <Button size="sm" onClick={() => openPopup('Add location', <AddLocationPopup onSaved={fetchLocations} />)}>
            Add Location
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading locations…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Network default</TableHead>
                <TableHead>Lat/Lon</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No locations yet.
                  </TableCell>
                </TableRow>
              ) : (
                locations.map(loc => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={loc.role === 'origin' ? 'secondary' : loc.role === 'destination' ? 'default' : 'outline'}
                        className="text-xs capitalize"
                      >
                        {loc.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {loc.defaultForNetworkId ? networkName(loc.defaultForNetworkId) : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <a
                        href={googleMapsUrl(loc.lat, loc.lon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}
                      </a>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${loc.name}`}
                        onClick={() => openPopup('Edit location', <EditLocationPopup location={loc} onSaved={fetchLocations} />)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${loc.name}`}
                        onClick={() => setDeleteTarget(loc)}
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
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the pickup/arrival dropdowns and its drive times to every other location.
              Blocked if any upcoming ride still uses it. Past rides that used it will keep working but show
              a fallback name instead. This cannot be undone.
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
