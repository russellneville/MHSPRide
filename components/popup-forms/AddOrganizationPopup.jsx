import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { usePopup } from "@/context/PopupContext"
import { auth, db } from "@/lib/firebaseClient"
import { doc, getDoc } from "firebase/firestore"
import { logEvent } from "@/lib/activityLog"
import { toast } from "sonner"

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function AddOrganizationPopup({ onSaved }) {
  const { closePopup } = usePopup()
  const [displayName, setDisplayName] = useState("")
  const [id, setId] = useState("")
  const [idTouched, setIdTouched] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleNameChange = (e) => {
    const value = e.target.value
    setDisplayName(value)
    if (!idTouched) setId(slugify(value))
  }

  const canSubmit = displayName.trim() && id.trim() && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError("")
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/organizations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: id.trim(), displayName: displayName.trim(), logoUrl: logoUrl.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not create organization")

      const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
      const actorData = actorDoc?.data() || {}
      logEvent({
        type: "organization.created",
        message: `Organization created: ${displayName.trim()} (${data.id})`,
        userId: auth.currentUser?.uid,
        userName: actorData.fullname,
        mhspNumber: actorData.mhspNumber,
        metadata: { orgId: data.id },
      }).catch(() => {})

      toast.success(`Added ${displayName.trim()}`)
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
        <Label htmlFor="org-name">Display name</Label>
        <Input id="org-name" value={displayName} onChange={handleNameChange} placeholder="Armadillo Mountain Ski Patrol" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-id">Org ID</Label>
        <Input
          id="org-id"
          value={id}
          onChange={(e) => { setId(slugify(e.target.value)); setIdTouched(true) }}
          placeholder="armadillo-mountain"
        />
        <p className="text-xs text-muted-foreground">Lowercase, hyphenated — this becomes the Firestore doc ID and can't be changed later.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-logo">Logo URL (optional)</Label>
        <Input id="org-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-4 pt-2">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Adding…" : "Add organization"}
        </Button>
      </div>
    </div>
  )
}
