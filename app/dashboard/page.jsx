'use client'
import { useNetwork } from "@/context/NetworksContext"
import DashboardLayout from "./dashboardLayout"
import { useAuth } from "@/context/AuthContext"
import { useEffect, useState } from "react"
import StatsCard from "@/components/ui/stats-card"
import { Car, Check, Ticket, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Dashboard() {
  const { getRides, getBookings, getNetworkList } = useNetwork()
  const { user } = useAuth()
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [networks, setNetworks] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      const [rideData, bookingData, networkData] = await Promise.all([
        getRides(),
        getBookings(),
        getNetworkList(),
      ])
      setRides(rideData)
      setBookings(bookingData)
      setNetworks(networkData || [])
    }
    fetchData()
  }, [user])

  const totalPassengers = rides.reduce((acc, ride) => acc + (ride.passengers?.length || 0), 0)
  const completedBookings = bookings.filter(b => b.booking_status === 'finished')
  const hasNetworks = networks.length > 0

  return (
    <DashboardLayout>
      <h3 className="text-xl font-semibold mb-4">
        Welcome, {user?.fullname}
      </h3>

      {hasNetworks ? (
        <div className="flex gap-3 mb-6">
          <Button asChild>
            <Link href="/dashboard/rides/offer">Offer a Ride</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/rides/find">Find a Ride</Link>
          </Button>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-5">
          <p className="font-medium mb-1">You haven't joined a network yet.</p>
          <p className="text-sm text-muted-foreground mb-3">
            Join a network to start offering or finding rides with other MHSP volunteers.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/networks">Browse Networks</Link>
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Rides I'm Driving</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatsCard title="Rides Offered" statnumber={rides.length} icon={Car} href="/dashboard/rides" />
            <StatsCard title="Rides Finished" statnumber={rides.filter(r => r.ride_status === 'finished').length} icon={Check} href="/dashboard/rides" />
            <StatsCard title="Riders Carried" statnumber={totalPassengers} icon={Users} href="/dashboard/rides" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Rides I'm Taking</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatsCard title="Total Bookings" statnumber={bookings.length} icon={Ticket} href="/dashboard/bookings" />
            <StatsCard title="Completed" statnumber={completedBookings.length} icon={Check} href="/dashboard/bookings" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
