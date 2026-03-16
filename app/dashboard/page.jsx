'use client'
import { useNetwork } from "@/context/NetworksContext"
import DashboardLayout from "./dashboardLayout"
import { useAuth } from "@/context/AuthContext"
import { useEffect, useState } from "react"
import StatsCard from "@/components/ui/stats-card"
import { Car, Check, Users } from "lucide-react"

export default function Dashboard() {
  const { getRides, getBookings, getNetworkList } = useNetwork()
  const { user } = useAuth()
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [networks, setNetworks] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      if (user.role === "driver") {
        const rideData = await getRides()
        setRides(rideData)
      } 
      else if (user.role === "passenger") {
        const bookingData = await getBookings()
        setBookings(bookingData)
      } 
      else if (user.role === "director") {
        const networkData = await getNetworkList()
        setNetworks(networkData)
      }
    }

    fetchData()
  }, [user])

  // === DRIVER STATS ===
  const totalPassengers = rides.reduce((acc, ride) => {
    return acc + (ride.passengers ? ride.passengers.length : 0)
  }, 0)

  // === PASSENGER STATS ===
  const totalBookings = bookings.length
  const completedBookings = bookings.filter(r => r.booking_status == 'finished')

  // === DIRECTOR STATS ===
  const totalNetworks = networks.length
  const totalDrivers = networks.reduce((acc, net) => acc + (net.drivers?.length || 0), 0)
  const totalPassengersDir = networks.reduce((acc, net) => acc + (net.passengers?.length || 0), 0)

  return (
    <DashboardLayout>
      <h3 className="text-xl font-semibold mb-4">
        Welcome {user?.fullname}
      </h3>

      {/* DRIVER DASHBOARD */}
      {user?.role === "driver" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatsCard title="Total Rides" statnumber={rides.length} icon={Car} />
          <StatsCard title="Finished Rides" statnumber={rides.filter(r=>r.ride_status == 'finished').length} icon={Check} />
          <StatsCard title="Total Passengers" statnumber={totalPassengers} icon={Users} />
        </div>
      )}

      {/* PASSENGER DASHBOARD */}
      {user?.role === "passenger" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatsCard title="Total Bookings" statnumber={totalBookings} icon={Car} />
          <StatsCard title="Completed Bookings" statnumber={completedBookings.length} icon={Car} />
        </div>
      )}

      {/* DIRECTOR DASHBOARD */}
      {user?.role === "director" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatsCard title="Total Networks" statnumber={totalNetworks} icon={Car} />
          <StatsCard title="Total Drivers" statnumber={totalDrivers} icon={Users} />
          <StatsCard title="Total Passengers" statnumber={totalPassengersDir} icon={Users} />
        </div>
      )}
    </DashboardLayout>
  )
}
