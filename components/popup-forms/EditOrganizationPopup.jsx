import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { usePopup } from "@/context/PopupContext"
import { auth, db } from "@/lib/firebaseClient"
import { doc, getDoc } from "firebase/firestore"
import { logEvent } from "@/lib/activityLog"
import { toast } from "sonner"

export default function EditOrganizationPopup({ org, onSaved }) {
  const { closePopup } = usePopup()
  const [displayName, setDisplayName] = useState(org.displayName || "")
  const [logoUrl, setLogoUrl] = useState(org.logoUrl || "")
  const [productName, setProductName] = useState(org.productName || "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = displayName.trim() && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError("")
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/organizations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: org.id, displayName: displayName.trim(), logoUrl: logoUrl.trim(), productName: productName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update organization")

      const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
      const actorData = actorDoc?.data() || {}
      logEvent({
        type: "organization.updated",
        message: `Organization updated: ${displayName.trim()} (${org.id})`,
        userId: auth.currentUser?.uid,
        userName: actorData.fullname,
        mhspNumber: actorData.mhspNumber,
        metadata: { orgId: org.id },
      }).catch(() => {})

      toast.success(`Updated ${displayName.trim()}`)
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
        <Label>Org ID</Label>
        <Input value={org.id} disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-name">Display name</Label>
        <Input id="org-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-logo">Logo URL</Label>
        <Input id="org-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        {logoUrl && (
          <div className="flex items-center gap-2 pt-1">
            <img src={logoUrl} alt="Logo preview" className="h-10 w-10 rounded object-contain bg-white border" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <span className="text-xs text-muted-foreground">Preview</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-product-name">App name</Label>
        <Input id="org-product-name" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Troopiter Ride" />
        <p className="text-xs text-muted-foreground">What this org's members see as the app's name. Leave blank to use "Troopiter Ride".</p>
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
