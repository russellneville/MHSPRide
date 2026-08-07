'use client'
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useNetwork } from "@/context/NetworksContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/ui/user-avatar"
import { Check, Star, Users } from "lucide-react"
import { NETWORKS, defaultFavoritesFor } from "@/lib/networks"
import VehicleForm from "@/components/forms/VehicleForm"
import { createVehicleId, EMPTY_VEHICLE } from "@/lib/vehicles"
import { PHONE_MAX_LENGTH } from "@/lib/utils"

const TOTAL_STEPS = 5

export default function OnboardingPage() {
  const router = useRouter()
  const { user, updateProfile, uploadPhoto } = useAuth()
  const { saveFavorites } = useNetwork()

  const [step, setStep] = useState(1)
  const [favorites, setFavorites] = useState([])
  const [favoritesSaving, setFavoritesSaving] = useState(false)
  const [vehicle, setVehicle] = useState({ ...EMPTY_VEHICLE })
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const fileInputRef = useRef(null)

  // Accounts created via the Troopiter launch shortcut skip /register
  // entirely, so they arrive here with no phone on file yet — self-service
  // registrants already gave one during account setup and skip this.
  const needsPhone = !user?.phone
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)

  // Pre-favorite networks from the user's roster classifications (issue #69);
  // they can toggle others on/off but must keep at least one.
  useEffect(() => {
    if (!user || favorites.length > 0) return
    setFavorites(defaultFavoritesFor(user.classifications))
  }, [user])

  const toggleFavorite = (networkId) => {
    setFavorites(prev => prev.includes(networkId)
      ? prev.filter(id => id !== networkId)
      : [...prev, networkId])
  }

  const handleSaveFavorites = async () => {
    setFavoritesSaving(true)
    const ok = await saveFavorites(favorites)
    setFavoritesSaving(false)
    if (ok) setStep(4)
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    const result = await uploadPhoto(file)
    setPhotoUploading(false)
    if (result) setPhotoUploaded(true)
  }

  const hasVehicleInput = vehicle.make.trim() || vehicle.model.trim() || vehicle.year.trim() ||
    vehicle.color || vehicle.seats || vehicle.plate.trim() || vehicle.storage.length > 0

  const handleSaveVehicle = async () => {
    setSaving(true)
    if (hasVehicleInput) {
      await updateProfile({
        vehicles: [{
          id: createVehicleId(),
          make: vehicle.make.trim(),
          model: vehicle.model.trim(),
          year: vehicle.year.trim(),
          color: vehicle.color,
          seats: vehicle.seats ? Number(vehicle.seats) : "",
          plate: vehicle.plate.trim(),
          storage: vehicle.storage,
          isDefault: true,
        }],
      })
    }
    setSaving(false)
    setStep(5)
  }

  const handleStep1Continue = async () => {
    if (!needsPhone) {
      setStep(2)
      return
    }
    if (!phone.trim()) {
      setPhoneError('A phone number is required so drivers and riders can reach you.')
      return
    }
    setPhoneError('')
    setPhoneSaving(true)
    await updateProfile({ phone: phone.trim() })
    setPhoneSaving(false)
    setStep(2)
  }

  const handleComplete = async () => {
    setSaving(true)
    await updateProfile({ onboarding_complete: true })
    setSaving(false)
    router.replace("/dashboard/faq")
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
              <CardTitle className="text-2xl">Welcome to MHSP Ride, {user?.fullname}!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                MHSP Ride connects Mount Hood Ski Patrol volunteers for carpooling to and from the mountain.
                This quick setup takes about a minute.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Favorite your patrol networks</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Add your vehicle details</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Start offering or finding rides</li>
              </ul>
              {needsPhone && (
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="onboarding-phone">Phone number</Label>
                  <Input
                    id="onboarding-phone"
                    type="tel"
                    value={phone}
                    maxLength={PHONE_MAX_LENGTH}
                    onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                    placeholder="(503) 555-0100"
                    aria-invalid={!!phoneError}
                  />
                  <p className="text-xs text-muted-foreground">
                    So drivers and riders can reach you about a ride.
                  </p>
                  {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
                </div>
              )}
              <Button className="w-full" disabled={phoneSaving} onClick={handleStep1Continue}>
                {phoneSaving ? 'Saving...' : 'Get Started'}
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

        {/* Step 3: Favorite Networks */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Networks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Favorited networks show their available rides on your dashboard.
                We picked defaults from your patrol classification. Favorite as
                many as you like, but keep at least one.
              </p>
              <div className="space-y-3">
                {NETWORKS.map(net => {
                  const favorited = favorites.includes(net.id)
                  return (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => toggleFavorite(net.id)}
                      className={`w-full flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                        favorited
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{net.name}</span>
                          <p className="text-sm text-muted-foreground">{net.description}</p>
                        </div>
                      </div>
                      <Star className={`h-5 w-5 shrink-0 ${favorited ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  )
                })}
              </div>
              <Button
                className="w-full"
                disabled={favorites.length === 0 || favoritesSaving}
                onClick={handleSaveFavorites}
              >
                {favoritesSaving ? "Saving..." : favorites.length === 0 ? "Favorite at least one network" : "Continue"}
              </Button>
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
                You can add more vehicles later from your profile.
              </p>
              <VehicleForm vehicle={vehicle} onChange={setVehicle} />
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
