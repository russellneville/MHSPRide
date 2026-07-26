import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { usePopup } from "@/context/PopupContext"
import { auth, db } from "@/lib/firebaseClient"
import { doc, getDoc } from "firebase/firestore"
import { logEvent } from "@/lib/activityLog"
import { toast } from "sonner"

export default function EditLocationPopup({ location, onSaved }) {
  const { closePopup } = usePopup()
  const [name, setName] = useState(location.name)
  const [lat, setLat] = useState(String(location.lat))
  const [lon, setLon] = useState(String(location.lon))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const hasValidCoords = lat !== "" && lon !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
  const canSubmit = name.trim() && hasValidCoords && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError("")
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/locations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: location.id, name: name.trim(), lat: Number(lat), lon: Number(lon) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update location")

      const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
      const actorData = actorDoc?.data() || {}
      logEvent({
        type: "location.updated",
        message: `Location updated: ${location.name} → ${name.trim()}`,
        userId: auth.currentUser?.uid,
        userName: actorData.fullname,
        mhspNumber: actorData.mhspNumber,
        metadata: { locationId: location.id },
      }).catch(() => {})

      toast.success("Location updated")
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
        <Label htmlFor="edit-location-name">Name</Label>
        <Input id="edit-location-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-location-lat">Latitude</Label>
          <Input id="edit-location-lat" value={lat} onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-location-lon">Longitude</Label>
          <Input id="edit-location-lon" value={lon} onChange={(e) => setLon(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-4 pt-2">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
