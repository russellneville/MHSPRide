import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { usePopup } from "@/context/PopupContext"
import { auth, db } from "@/lib/firebaseClient"
import { doc, getDoc } from "firebase/firestore"
import { logEvent } from "@/lib/activityLog"
import { toast } from "sonner"

function googleMapsUrl(lat, lon) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
}

export default function AddLocationPopup({ onSaved }) {
  const { closePopup } = usePopup()
  const [role, setRole] = useState("origin")
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [lat, setLat] = useState("")
  const [lon, setLon] = useState("")
  const [geocoded, setGeocoded] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const usesAddress = role === "origin" || role === "both"
  const hasValidCoords = lat !== "" && lon !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
  const confirmed = usesAddress ? geocoded && hasValidCoords : hasValidCoords
  const canSubmit = name.trim() && confirmed && !submitting

  const handleAddressChange = (e) => {
    setAddress(e.target.value)
    // Address changed since the last lookup — require a fresh geocode before submitting.
    setGeocoded(false)
  }

  const handleLookup = async () => {
    if (!address.trim()) return
    setGeocoding(true)
    setError("")
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not geocode that address")
      setLat(String(data.latitude))
      setLon(String(data.longitude))
      setGeocoded(true)
    } catch (err) {
      setGeocoded(false)
      setError(err.message)
    } finally {
      setGeocoding(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError("")
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/locations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), role, address: usesAddress ? address.trim() : "", lat: Number(lat), lon: Number(lon) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not add location")

      const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
      const actorData = actorDoc?.data() || {}
      logEvent({
        type: "location.added",
        message: `Location added: ${name.trim()} (${role})`,
        userId: auth.currentUser?.uid,
        userName: actorData.fullname,
        mhspNumber: actorData.mhspNumber,
        metadata: { locationId: data.id, role, driveTimeErrors: data.driveTimeErrors },
      }).catch(() => {})

      toast.success(`Added ${name.trim()}`)
      onSaved?.()
      closePopup()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Role</Label>
        <Select
          value={role}
          onValueChange={(v) => { setRole(v); setLat(""); setLon(""); setGeocoded(false); setError("") }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="origin">Origin (pickup / departure)</SelectItem>
            <SelectItem value="destination">Destination (mountain arrival)</SelectItem>
            <SelectItem value="both">Both (pickup and arrival)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-name">Name</Label>
        <Input id="location-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {usesAddress ? (
        <div className="space-y-2">
          <Label htmlFor="location-address">Address</Label>
          <div className="flex gap-2">
            <Input id="location-address" value={address} onChange={handleAddressChange} placeholder="Street address" />
            <Button type="button" variant="outline" onClick={handleLookup} disabled={!address.trim() || geocoding}>
              {geocoding ? "Looking up…" : "Look up"}
            </Button>
          </div>
          {geocoded && hasValidCoords && (
            <p className="text-sm text-muted-foreground">
              Resolved to {Number(lat).toFixed(5)}, {Number(lon).toFixed(5)} —{" "}
              <a href={googleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                view on map
              </a>{" "}
              to confirm before adding.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location-lat">Latitude</Label>
            <Input id="location-lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="45.3203457" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-lon">Longitude</Label>
            <Input id="location-lon" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-121.6231353" />
          </div>
          {hasValidCoords && (
            <p className="col-span-2 text-sm text-muted-foreground">
              <a href={googleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                View on map
              </a>{" "}
              to confirm before adding.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-4 pt-2">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Adding location and computing drive times…" : "Add location"}
        </Button>
      </div>
    </div>
  )
}
