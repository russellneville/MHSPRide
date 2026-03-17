'use client'
import { useNetwork } from "@/context/NetworksContext"
import DashboardLayout from "./dashboardLayout"
import { useAuth } from "@/context/AuthContext"
import { useEffect, useState } from "react"
import StatsCard from "@/components/ui/stats-card"
import { Car, Check, Ticket, Users } from "lucide-react"

export default function Dashboard() {
  const { getRides, getBookings } = useNetwork()
  const { user } = useAuth()
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      const [rideData, bookingData] = await Promise.all([getRides(), getBookings()])
      setRides(rideData)
      setBookings(bookingData)
    }
    fetchData()
  }, [user])

  const totalPassengers = rides.reduce((acc, ride) => acc + (ride.passengers?.length || 0), 0)
  const completedBookings = bookings.filter(b => b.booking_status === 'finished')

  return (
    <DashboardLayout>
      <h3 className="text-xl font-semibold mb-4">
        Welcome, {user?.fullname}
      </h3>

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Rides I'm Driving</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatsCard title="Rides Offered" statnumber={rides.length} icon={Car} />
            <StatsCard title="Rides Finished" statnumber={rides.filter(r => r.ride_status === 'finished').length} icon={Check} />
            <StatsCard title="Riders Carried" statnumber={totalPassengers} icon={Users} />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Rides I'm Taking</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatsCard title="Total Bookings" statnumber={bookings.length} icon={Ticket} />
            <StatsCard title="Completed" statnumber={completedBookings.length} icon={Check} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
