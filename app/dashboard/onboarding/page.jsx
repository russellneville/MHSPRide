'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useNetwork } from "@/context/NetworksContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, Users } from "lucide-react"

const NETWORKS = [
  { id: "network-HILLPATROL", label: "Hill Patrol" },
  { id: "network-MOUNTAINHOSTS", label: "Mountain Hosts" },
  { id: "network-NORDIC", label: "Nordic" },
]

const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const router = useRouter()
  const { user, updateProfile } = useAuth()
  const { joinNetwork } = useNetwork()

  const [step, setStep] = useState(1)
  const [joinedNetworks, setJoinedNetworks] = useState([])
  const [joiningId, setJoiningId] = useState(null)
  const [vehicle, setVehicle] = useState({
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_seats: "",
    vehicle_plate: "",
  })
  const [saving, setSaving] = useState(false)

  const handleJoinNetwork = async (networkId) => {
    if (joinedNetworks.includes(networkId)) return
    setJoiningId(networkId)
    try {
      await joinNetwork(networkId)
      setJoinedNetworks(prev => [...prev, networkId])
    } catch {
      // joinNetwork shows its own toast on error
    } finally {
      setJoiningId(null)
    }
  }

  const handleVehicleChange = (e) => {
    setVehicle(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSaveVehicle = async () => {
    setSaving(true)
    const payload = {}
    if (vehicle.vehicle_make.trim()) payload.vehicle_make = vehicle.vehicle_make.trim()
    if (vehicle.vehicle_model.trim()) payload.vehicle_model = vehicle.vehicle_model.trim()
    if (vehicle.vehicle_year.trim()) payload.vehicle_year = vehicle.vehicle_year.trim()
    if (vehicle.vehicle_seats) payload.vehicle_seats = Number(vehicle.vehicle_seats)
    if (vehicle.vehicle_plate.trim()) payload.vehicle_plate = vehicle.vehicle_plate.trim()
    if (Object.keys(payload).length > 0) {
      await updateProfile(payload)
    }
    setSaving(false)
    setStep(4)
  }

  const handleComplete = async () => {
    setSaving(true)
    await updateProfile({ onboarding_complete: true })
    setSaving(false)
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full flex-1 transition-colors ${
                i + 1 <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Welcome to MHSPRide, {user?.fullname}!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                MHSPRide connects Mount Hood Ski Patrol volunteers for carpooling to and from the mountain.
                This quick setup takes about a minute.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Join one or more patrol networks</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Add your vehicle details</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Start offering or finding rides</li>
              </ul>
              <Button className="w-full" onClick={() => setStep(2)}>
                Get Started
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Join a Network */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Join a Network</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Networks group volunteers by patrol type. You can join more than one.
              </p>
              <div className="space-y-3">
                {NETWORKS.map(net => {
                  const joined = joinedNetworks.includes(net.id)
                  return (
                    <div key={net.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{net.label}</span>
                        {joined && <Badge variant="secondary">Joined</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant={joined ? "outline" : "default"}
                        disabled={joined || joiningId === net.id}
                        onClick={() => handleJoinNetwork(net.id)}
                      >
                        {joiningId === net.id ? "Joining..." : joined ? "Joined" : "Join"}
                      </Button>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep(3)}>
                  Skip
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Vehicle Setup */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Adding your vehicle helps passengers know what to look for when you offer rides.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="vehicle_make">Make</Label>
                  <Input
                    id="vehicle_make"
                    name="vehicle_make"
                    placeholder="e.g. Toyota"
                    value={vehicle.vehicle_make}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vehicle_model">Model</Label>
                  <Input
                    id="vehicle_model"
                    name="vehicle_model"
                    placeholder="e.g. 4Runner"
                    value={vehicle.vehicle_model}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vehicle_year">Year</Label>
                  <Input
                    id="vehicle_year"
                    name="vehicle_year"
                    placeholder="e.g. 2021"
                    value={vehicle.vehicle_year}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vehicle_seats">Seats (2–8)</Label>
                  <Input
                    id="vehicle_seats"
                    name="vehicle_seats"
                    type="number"
                    min={2}
                    max={8}
                    placeholder="e.g. 5"
                    value={vehicle.vehicle_seats}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="vehicle_plate">License Plate (optional)</Label>
                  <Input
                    id="vehicle_plate"
                    name="vehicle_plate"
                    placeholder="e.g. ABC-1234"
                    value={vehicle.vehicle_plate}
                    onChange={handleVehicleChange}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => setStep(4)}
                >
                  Skip
                </Button>
                <Button
                  className="flex-1"
                  disabled={saving}
                  onClick={handleSaveVehicle}
                >
                  {saving ? "Saving..." : "Save & Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>You're all set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Start offering or finding rides with other MHSP volunteers.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    await updateProfile({ onboarding_complete: true })
                    setSaving(false)
                    router.replace("/dashboard/networks")
                  }}
                >
                  Go to Networks
                </Button>
                <Button
                  className="flex-1"
                  disabled={saving}
                  onClick={handleComplete}
                >
                  {saving ? "Loading..." : "Go to Dashboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
