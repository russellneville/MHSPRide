'use client'
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useNetwork } from "@/context/NetworksContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/ui/user-avatar"
import { Check, Users } from "lucide-react"

const STORAGE_OPTIONS = [
  { value: "ski_box",    label: "Ski/board roof box" },
  { value: "roof_rack",  label: "Roof rack" },
  { value: "trunk",      label: "Trunk" },
  { value: "back_seats", label: "Back seats" },
  { value: "truck_bed",  label: "Truck bed" },
  { value: "cargo_area", label: "Cargo area (SUV/van)" },
]

const NETWORKS = [
  { id: "network-HILLPATROL", label: "Hill Patrol" },
  { id: "network-MOUNTAINHOSTS", label: "Mountain Hosts" },
  { id: "network-NORDIC", label: "Nordic" },
]

const TOTAL_STEPS = 5

export default function OnboardingPage() {
  const router = useRouter()
  const { user, updateProfile, uploadPhoto } = useAuth()
  const { joinNetwork } = useNetwork()

  const [step, setStep] = useState(1)
  const [joinedNetworks, setJoinedNetworks] = useState([])
  const [joiningId, setJoiningId] = useState(null)
  const [vehicle, setVehicle] = useState({
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_color: "",
    vehicle_seats: "",
    vehicle_plate: "",
    vehicle_storage: [],
  })
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const fileInputRef = useRef(null)

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

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    const result = await uploadPhoto(file)
    setPhotoUploading(false)
    if (result) setPhotoUploaded(true)
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
    if (vehicle.vehicle_color) payload.vehicle_color = vehicle.vehicle_color
    if (vehicle.vehicle_seats) payload.vehicle_seats = Number(vehicle.vehicle_seats)
    if (vehicle.vehicle_plate.trim()) payload.vehicle_plate = vehicle.vehicle_plate.trim()
    if (vehicle.vehicle_storage.length > 0) payload.vehicle_storage = vehicle.vehicle_storage
    if (Object.keys(payload).length > 0) {
      await updateProfile(payload)
    }
    setSaving(false)
    setStep(5)
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

        {/* Step 2: Photo Upload */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Add your photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Carpoolers recognize each other faster with a photo. You can always add one later from your profile.
              </p>
              <div className="flex flex-col items-center gap-4 py-2">
                <UserAvatar user={user} size="xl" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={photoUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoUploading ? 'Uploading...' : 'Choose photo'}
                </Button>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant={photoUploaded ? 'ghost' : 'default'}
                  className="flex-1"
                  disabled={photoUploading}
                  onClick={() => setStep(3)}
                >
                  Skip for now
                </Button>
                <Button
                  variant={photoUploaded ? 'default' : 'ghost'}
                  className="flex-1"
                  disabled={photoUploading}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Join a Network */}
        {step === 3 && (
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
                <Button variant="ghost" className="flex-1" onClick={() => setStep(4)}>
                  Skip
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Vehicle Setup */}
        {step === 4 && (
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
                  <Label htmlFor="vehicle_color">Color</Label>
                  <Select
                    value={vehicle.vehicle_color}
                    onValueChange={(value) => setVehicle(prev => ({ ...prev, vehicle_color: value }))}
                  >
                    <SelectTrigger id="vehicle_color">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Black","White","Silver","Gray","Red","Blue","Green","Brown","Beige","Orange","Yellow","Gold","Purple","Other"].map(c => (
                        <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vehicle_seats">Passenger Seats</Label>
                  <Input
                    id="vehicle_seats"
                    name="vehicle_seats"
                    type="number"
                    min={1}
                    placeholder="e.g. 4"
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
                <div className="col-span-2 space-y-2">
                  <Label>Equipment Storage</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {STORAGE_OPTIONS.map(opt => {
                      const checked = vehicle.vehicle_storage.includes(opt.value)
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                            checked
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={() => setVehicle(prev => ({
                              ...prev,
                              vehicle_storage: checked
                                ? prev.vehicle_storage.filter(v => v !== opt.value)
                                : [...prev.vehicle_storage, opt.value]
                            }))}
                          />
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => setStep(5)}
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

        {/* Step 5: Done */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>You're all set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Start offering or finding rides with other MHSP volunteers.
              </p>
              <Button
                className="w-full"
                disabled={saving}
                onClick={handleComplete}
              >
                {saving ? "Loading..." : "Complete setup"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
