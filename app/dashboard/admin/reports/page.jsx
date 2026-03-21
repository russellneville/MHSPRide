'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { resolveLocation } from '@/lib/locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminReportsPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <ReportsContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function ReportsContent() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalUsers: 0, totalRides: 0, totalBookings: 0, activeRides: 0 })
  const [topDrivers, setTopDrivers] = useState([])
  const [topRiders, setTopRiders] = useState([])
  const [topRoutes, setTopRoutes] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [usersSnap, ridesSnap, bookingsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'rides')),
        getDocs(collection(db, 'bookings')),
      ])

      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const rides = ridesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const now = new Date()
      const activeRides = rides.filter(r => {
        if (r.ride_status === 'canceled' || r.ride_status === 'finished') return false
        const dep = new Date(`${r.departure_date}T${r.departure_time || '00:00'}`)
        return dep > now
      }).length

      setStats({
        totalUsers: users.length,
        totalRides: rides.length,
        totalBookings: bookings.length,
        activeRides,
      })

      // Top Drivers
      const driverMap = {}
      rides.forEach(ride => {
        if (!ride.driverId) return
        if (!driverMap[ride.driverId]) {
          driverMap[ride.driverId] = {
            driverId: ride.driverId,
            name: ride.driver?.fullname || '—',
            mhspNumber: ride.driver?.mhspNumber || '—',
            ridesOffered: 0,
            seatsProvided: 0,
          }
        }
        driverMap[ride.driverId].ridesOffered += 1
        driverMap[ride.driverId].seatsProvided += ride.total_seats || 0
      })
      const sortedDrivers = Object.values(driverMap)
        .sort((a, b) => b.ridesOffered - a.ridesOffered)
        .slice(0, 10)
      setTopDrivers(sortedDrivers)

      // Top Riders
      const riderMap = {}
      bookings.forEach(booking => {
        if (!booking.passengerId) return
        if (booking.booking_status === 'canceled' || booking.booking_status === 'cancled') return
        if (!riderMap[booking.passengerId]) {
          riderMap[booking.passengerId] = {
            passengerId: booking.passengerId,
            name: booking.passenger?.fullname || '—',
            mhspNumber: booking.passenger?.mhspNumber || '—',
            ridesBooked: 0,
            seatsUsed: 0,
          }
        }
        riderMap[booking.passengerId].ridesBooked += 1
        riderMap[booking.passengerId].seatsUsed += booking.booked_seats || 1
      })
      const sortedRiders = Object.values(riderMap)
        .sort((a, b) => b.ridesBooked - a.ridesBooked)
        .slice(0, 10)
      setTopRiders(sortedRiders)

      // Route Popularity
      const routeMap = {}
      rides.forEach(ride => {
        if (!ride.departure || !ride.arrival) return
        const key = `${ride.departure}|||${ride.arrival}`
        routeMap[key] = (routeMap[key] || 0) + 1
      })
      const sortedRoutes = Object.entries(routeMap)
        .map(([key, count]) => {
          const [dep, arr] = key.split('|||')
          return { departure: dep, arrival: arr, count }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      setTopRoutes(sortedRoutes)

    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Reports</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Reports</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Total Rides" value={stats.totalRides} />
        <StatCard title="Total Bookings" value={stats.totalBookings} />
        <StatCard title="Active Rides" value={stats.activeRides} description="Future, not canceled" />
      </div>

      {/* Top Drivers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Drivers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>MHSP #</TableHead>
                  <TableHead className="text-right">Rides Offered</TableHead>
                  <TableHead className="text-right">Seats Provided</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data.</TableCell>
                  </TableRow>
                ) : (
                  topDrivers.map((d, i) => (
                    <TableRow key={d.driverId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground">{d.mhspNumber}</TableCell>
                      <TableCell className="text-right">{d.ridesOffered}</TableCell>
                      <TableCell className="text-right">{d.seatsProvided}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top Riders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Riders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>MHSP #</TableHead>
                  <TableHead className="text-right">Rides Booked</TableHead>
                  <TableHead className="text-right">Seats Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRiders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data.</TableCell>
                  </TableRow>
                ) : (
                  topRiders.map((r, i) => (
                    <TableRow key={r.passengerId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.mhspNumber}</TableCell>
                      <TableCell className="text-right">{r.ridesBooked}</TableCell>
                      <TableCell className="text-right">{r.seatsUsed}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Route Popularity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Route Popularity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Departure</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead className="text-right">Ride Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No data.</TableCell>
                  </TableRow>
                ) : (
                  topRoutes.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{resolveLocation(r.departure)}</TableCell>
                      <TableCell>{resolveLocation(r.arrival)}</TableCell>
                      <TableCell className="text-right font-medium">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, description }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}
