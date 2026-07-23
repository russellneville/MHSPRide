'use client'
import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs } from 'firebase/firestore'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 50

function primaryClassification(classifications) {
  if (!classifications?.length) return null
  // Strip the date suffix to keep the display compact
  return classifications[0].replace(/\s+\d{4}-\d{2}-\d{2}$/, '').trim()
}

function isActiveStatus(status) {
  return (status || '').trim().toLowerCase() === 'active'
}

function googleMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

function statusVariant(status) {
  if (!status) return 'secondary'
  const s = status.toLowerCase()
  if (s === 'active') return 'default'
  if (s.includes('not finish') || s.includes('inactive')) return 'destructive'
  return 'secondary'
}

export default function RosterPage() {
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [activeFilter, setActiveFilter] = useState('active') // 'active' | 'inactive' | 'registered' | 'all'
  const [page, setPage]         = useState(1)

  useEffect(() => {
    getDocs(collection(db, 'members'))
      .then(snap => {
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ln = (a.lastName || '').localeCompare(b.lastName || '')
            return ln !== 0 ? ln : (a.firstName || '').localeCompare(b.firstName || '')
          })
        setMembers(rows)
      })
      .catch(err => console.error('[roster]', err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return members.filter(m => {
      // Status filter — based on the roster Status text, not the internal
      // `active` flag (which only tracks whether the member is still present
      // in the most recently imported roster CSV, not their Status value).
      if (activeFilter === 'active'     && !isActiveStatus(m.status)) return false
      if (activeFilter === 'inactive'   && isActiveStatus(m.status)) return false
      if (activeFilter === 'registered' && !m.claimed) return false

      // Search
      if (!q) return true
      const matchName  = (m.lastName   || '').toLowerCase().startsWith(q)
      const matchMhsp  = (m.mhspNumber || '').toLowerCase().startsWith(q)
      const matchEmail = (m.email      || '').toLowerCase().includes(q)
      return matchName || matchMhsp || matchEmail
    })
  }, [members, search, activeFilter])

  // Reset to page 1 whenever filter/search changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearch(e) {
    setSearch(e.target.value)
    setPage(1)
  }

  function handleFilter(val) {
    setActiveFilter(val)
    setPage(1)
  }

  return (
    <AdminGuard>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Roster</h3>
            {!loading && (
              <span className="text-sm text-muted-foreground">
                {filtered.length.toLocaleString()} of {members.length.toLocaleString()} members
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <Input
              placeholder="Search by last name, MHSP #, or email…"
              value={search}
              onChange={handleSearch}
              className="max-w-xs"
            />
            <Select value={activeFilter} onValueChange={handleFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading roster…</p>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>MHSP #</TableHead>
                      <TableHead>Troopiter Email</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Lat/Lon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No members match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map(m => {
                        const primary = primaryClassification(m.classifications)
                        const extra   = (m.classifications?.length ?? 0) - 1
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {m.lastName}, {m.firstName}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{m.mhspNumber}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {m.email || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {primary
                                ? <>{primary}{extra > 0 && <span className="ml-1 text-xs">+{extra}</span>}</>
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {m.status
                                ? <Badge variant={statusVariant(m.status)} className="text-xs">{m.status}</Badge>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {m.claimed
                                ? <Badge variant="default" className="text-xs">Registered</Badge>
                                : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {m.latitude != null && m.longitude != null
                                ? (
                                  <a
                                    href={googleMapsUrl(m.latitude, m.longitude)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                                  </a>
                                )
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Page {safePage} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    </AdminGuard>
  )
}
